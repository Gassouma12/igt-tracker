import { useMemo, useState } from 'react'
import { Eye, Search, UserCheck, UserX } from 'lucide-react'
import { useDB } from '@/data/store'
import { useCurrentUser } from '@/state/session'
import { updateUser } from '@/data/actions'
import type { Role, User } from '@/data/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Avatar, Button } from '@/components/ui/primitives'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { Dropdown } from '@/components/ui/Dropdown'
import { MemberPipelineModal } from '@/features/shared/MemberPipelineModal'
import { usePaged } from '@/lib/usePaged'

const ROLES: Role[] = ['admin', 'lcp', 'lcvp', 'member']
const ROLE_OPTS = ROLES.map((r) => ({ value: r, label: r.toUpperCase() }))

export default function UserManagement() {
  const actor = useCurrentUser()
  const users = useDB((s) => s.users)
  const lcs = useDB((s) => s.localCommittees)
  const [q, setQ] = useState('')
  const [lcFilter, setLcFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [viewing, setViewing] = useState<User | null>(null)

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return users
      .filter((u) => (!lcFilter || u.lcId === lcFilter) && (!roleFilter || u.role === roleFilter))
      .filter((u) => !term || u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [users, q, lcFilter, roleFilter])

  const lcName = (id: string | null) => lcs.find((l) => l.id === id)?.name ?? '—'
  const paged = usePaged(rows, 25)

  return (
    <div>
      <PageHeader title="User Management" subtitle={`${users.length} users across ${lcs.length} LCs`} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
          <input className="input pl-9" placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Dropdown
          className="w-44"
          value={lcFilter}
          onChange={setLcFilter}
          options={[{ value: '', label: 'All LCs' }, ...lcs.map((l) => ({ value: l.id, label: l.name }))]}
        />
        <Dropdown
          className="w-36"
          value={roleFilter}
          onChange={setRoleFilter}
          options={[{ value: '', label: 'All roles' }, ...ROLE_OPTS]}
        />
      </div>

      <Table>
        <THead><TR><TH>Member</TH><TH>Email</TH><TH>Role</TH><TH>Local Committee</TH><TH>Status</TH><TH>Pipeline</TH></TR></THead>
        <TBody>
          {paged.slice.map((u) => (
            <TR key={u.id}>
              <TD>
                <span className="flex items-center gap-2.5">
                  <Avatar name={u.name} size={30} />
                  <span><span className="block font-medium text-ink">{u.name}</span><span className="block text-xs text-ink-mute">{u.position}</span></span>
                </span>
              </TD>
              <TD>{u.email}</TD>
              <TD>
                <Dropdown
                  size="sm" className="w-28"
                  value={u.role}
                  onChange={(v) => actor && updateUser(actor, u.id, { role: v as Role })}
                  options={ROLE_OPTS}
                />
              </TD>
              <TD>
                <Dropdown
                  size="sm" className="w-36"
                  value={u.lcId ?? ''}
                  onChange={(v) => actor && updateUser(actor, u.id, { lcId: v || null })}
                  options={[{ value: '', label: '— None —' }, ...lcs.map((l) => ({ value: l.id, label: l.name }))]}
                />
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
              <TD>
                <Button size="sm" variant="ghost" onClick={() => setViewing(u)}><Eye size={14} /> View</Button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <Pagination page={paged.page} pageCount={paged.pageCount} from={paged.from} to={paged.to} total={paged.total} onChange={paged.setPage} />

      <MemberPipelineModal member={viewing} open={!!viewing} onClose={() => setViewing(null)} />
      <p className="mt-2 text-xs text-ink-mute">{rows.length} shown · changes are recorded in the activity log · LC names: {lcs.map((l) => lcName(l.id)).join(', ')}</p>
    </div>
  )
}
