import { useMemo, useRef, useState } from 'react'
import { Briefcase, Search, User as UserIcon } from 'lucide-react'
import { useDB } from '@/data/store'
import { useCurrentUser } from '@/state/session'
import { scopeOpportunities, visibleOwnerIds } from '@/lib/rbac'
import { CompanyDialog } from '@/features/member/CompanyDialog'
import { OpportunityDialog } from '@/features/member/OpportunityDialog'
import { MemberInfoModal } from '@/features/shared/MemberInfoModal'
import type { User } from '@/data/types'

interface Hit { kind: 'company' | 'contact' | 'member'; id: string; label: string; sub: string }

export function GlobalSearch() {
  const user = useCurrentUser()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const blurTimer = useRef<number | undefined>(undefined)

  // What a hit opens: a company drawer, an opportunity drawer, or a member card.
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [oppId, setOppId] = useState<string | null>(null)
  const [member, setMember] = useState<User | null>(null)

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

  function select(hit: Hit) {
    setOpen(false)
    setQ('')
    if (hit.kind === 'member') {
      setMember(users.find((u) => u.id === hit.id) ?? null)
    } else if (hit.kind === 'company') {
      setCompanyId(hit.id)
    } else {
      // contact → open the company it belongs to
      const ct = contacts.find((c) => c.id === hit.id)
      if (ct) setCompanyId(ct.companyId)
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

      {/* Result detail views — app-styled, role-scoped */}
      <CompanyDialog companyId={companyId} onClose={() => setCompanyId(null)} onOpenOpp={(id) => setOppId(id)} />
      <OpportunityDialog oppId={oppId} onClose={() => setOppId(null)} />
      <MemberInfoModal member={member} open={!!member} onClose={() => setMember(null)} />
    </div>
  )
}
