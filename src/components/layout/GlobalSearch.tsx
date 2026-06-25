import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Search, User as UserIcon } from 'lucide-react'
import { useDB } from '@/data/store'
import { useCurrentUser } from '@/state/session'
import { useFilters } from '@/state/filters'
import { scopeOpportunities, visibleOwnerIds } from '@/lib/rbac'

interface Hit { kind: 'company' | 'contact' | 'member'; id: string; label: string; sub: string }

export function GlobalSearch() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const setFilters = useFilters((s) => s.set)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const blurTimer = useRef<number | undefined>(undefined)

  const companies = useDB((s) => s.companies)
  const contacts = useDB((s) => s.contacts)
  const users = useDB((s) => s.users)
  const opportunities = useDB((s) => s.opportunities)

  const hits = useMemo<Hit[]>(() => {
    if (!user || q.trim().length < 2) return []
    const term = q.toLowerCase()
    const scopedOpps = scopeOpportunities(user, opportunities, users)
    const companyIds = new Set(scopedOpps.map((o) => o.companyId))
    const owners = visibleOwnerIds(user, users)

    const out: Hit[] = []
    for (const c of companies) {
      if (companyIds.has(c.id) && c.name.toLowerCase().includes(term)) {
        out.push({ kind: 'company', id: c.id, label: c.name, sub: c.industry ?? 'Company' })
      }
      if (out.length > 12) break
    }
    for (const ct of contacts) {
      if (companyIds.has(ct.companyId) && (ct.name.toLowerCase().includes(term) || ct.email?.toLowerCase().includes(term))) {
        out.push({ kind: 'contact', id: ct.id, label: ct.name, sub: ct.role ?? ct.email ?? 'Contact' })
      }
      if (out.length > 18) break
    }
    if (user.role === 'admin' || user.role === 'lcp') {
      for (const u of users) {
        if ((!owners || owners.has(u.id)) && u.name.toLowerCase().includes(term)) {
          out.push({ kind: 'member', id: u.id, label: u.name, sub: u.position })
        }
      }
    }
    return out.slice(0, 8)
  }, [q, user, companies, contacts, users, opportunities])

  if (!user) return null

  const listPath = user.role === 'member' ? '/me/companies' : user.role === 'admin' ? '/admin/users' : '/lc/pipeline'

  function select(hit: Hit) {
    setOpen(false)
    setQ('')
    if (hit.kind === 'member') {
      setFilters({ ownerId: hit.id, search: '' })
      navigate(user!.role === 'admin' ? '/admin/users' : '/lc/team')
    } else {
      setFilters({ search: hit.label })
      navigate(listPath)
    }
  }

  return (
    <div className="relative w-full max-w-md">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
      <input
        className="input pl-9"
        placeholder="Search companies, contacts, members…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurTimer.current = window.setTimeout(() => setOpen(false), 150) }}
      />
      {open && hits.length > 0 && (
        <div
          className="absolute z-40 mt-2 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
          onMouseDown={(e) => e.preventDefault()}
        >
          {hits.map((h) => (
            <button
              key={`${h.kind}-${h.id}`}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-surface-2"
              onClick={() => select(h)}
            >
              <span className="text-ink-mute">
                {h.kind === 'member' ? <UserIcon size={16} /> : <Briefcase size={16} />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm text-ink">{h.label}</span>
                <span className="block truncate text-xs text-ink-mute">{h.sub}</span>
              </span>
              <span className="ml-auto text-[10px] uppercase tracking-wide text-ink-mute">{h.kind}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
