import { useMemo, useState } from 'react'
import { Search, UserCheck, UserX } from 'lucide-react'
import { useDB } from '@/data/store'
import { useCurrentUser } from '@/state/session'
import { updateUser } from '@/data/actions'
import type { Role } from '@/data/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Avatar, Button } from '@/components/ui/primitives'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { Select } from '@/components/ui/Field'

const ROLES: Role[] = ['admin', 'lcp', 'lcvp', 'member']

export default function UserManagement() {
  const actor = useCurrentUser()
  const users = useDB((s) => s.users)
  const lcs = useDB((s) => s.localCommittees)
  const [q, setQ] = useState('')
  const [lcFilter, setLcFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return users
      .filter((u) => (!lcFilter || u.lcId === lcFilter) && (!roleFilter || u.role === roleFilter))
      .filter((u) => !term || u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [users, q, lcFilter, roleFilter])

  const lcName = (id: string | null) => lcs.find((l) => l.id === id)?.name ?? '—'

  return (
    <div>
      <PageHeader title="User Management" subtitle={`${users.length} users across ${lcs.length} LCs`} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
          <input className="input pl-9" placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="max-w-[180px]" value={lcFilter} onChange={(e) => setLcFilter(e.target.value)}>
          <option value="">All LCs</option>
          {lcs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </Select>
        <Select className="max-w-[150px]" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}
        </Select>
      </div>

      <Table>
        <THead><TR><TH>Member</TH><TH>Email</TH><TH>Role</TH><TH>Local Committee</TH><TH>Status</TH></TR></THead>
        <TBody>
          {rows.map((u) => (
            <TR key={u.id}>
              <TD>
                <span className="flex items-center gap-2.5">
                  <Avatar name={u.name} size={30} />
                  <span><span className="block font-medium text-ink">{u.name}</span><span className="block text-xs text-ink-mute">{u.position}</span></span>
                </span>
              </TD>
              <TD>{u.email}</TD>
              <TD>
                <Select className="h-8 py-0 text-xs" value={u.role} onChange={(e) => actor && updateUser(actor, u.id, { role: e.target.value as Role })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                </Select>
              </TD>
              <TD>
                <Select className="h-8 py-0 text-xs" value={u.lcId ?? ''} onChange={(e) => actor && updateUser(actor, u.id, { lcId: e.target.value || null })}>
                  <option value="">— None —</option>
                  {lcs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </Select>
              </TD>
              <TD>
                <Button
                  size="sm"
                  variant={u.active ? 'secondary' : 'danger'}
                  onClick={() => actor && updateUser(actor, u.id, { active: !u.active })}
                >
                  {u.active ? <><UserCheck size={14} /> Active</> : <><UserX size={14} /> Inactive</>}
                </Button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <p className="mt-2 text-xs text-ink-mute">{rows.length} shown · changes are recorded in the activity log · LC names: {lcs.map((l) => lcName(l.id)).join(', ')}</p>
    </div>
  )
}
