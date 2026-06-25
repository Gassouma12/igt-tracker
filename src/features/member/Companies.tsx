import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Plus, Search } from 'lucide-react'
import { useScopedData } from './useScopedData'
import { AddOpportunityDialog } from './AddOpportunityDialog'
import { OpportunityDialog } from './OpportunityDialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button, EmptyState } from '@/components/ui/primitives'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'
import { fmtDate } from '@/lib/format'
import { useFilters } from '@/state/filters'

export default function Companies() {
  const { opportunities, contacts, companyById } = useScopedData()
  const search = useFilters((s) => s.search)
  const setFilters = useFilters((s) => s.set)
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const map = new Map<string, { id: string; name: string; industry: string | null; opps: number; lastOppId: string; lastActivity: string | null }>()
    for (const o of opportunities) {
      const c = companyById(o.companyId)
      if (!c) continue
      const cur = map.get(c.id)
      if (!cur) map.set(c.id, { id: c.id, name: c.name, industry: c.industry, opps: 1, lastOppId: o.id, lastActivity: o.lastActivityAt })
      else { cur.opps++; if ((o.lastActivityAt ?? '') > (cur.lastActivity ?? '')) { cur.lastActivity = o.lastActivityAt; cur.lastOppId = o.id } }
    }
    const term = search.trim().toLowerCase()
    const contactsByCo = new Map<string, number>()
    for (const ct of contacts) contactsByCo.set(ct.companyId, (contactsByCo.get(ct.companyId) ?? 0) + 1)
    return [...map.values()]
      .filter((r) => !term || r.name.toLowerCase().includes(term))
      .map((r) => ({ ...r, contacts: contactsByCo.get(r.id) ?? 0 }))
      .sort((a, b) => (b.lastActivity ?? '').localeCompare(a.lastActivity ?? ''))
  }, [opportunities, contacts, companyById, search])

  return (
    <div>
      <PageHeader
        title="Companies"
        subtitle={`${rows.length} companies in your pipeline`}
        actions={<Button onClick={() => setAdding(true)}><Plus size={16} /> New opportunity</Button>}
      />

      <div className="relative mb-3 max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
        <input className="input pl-9" placeholder="Filter companies…" value={search} onChange={(e) => setFilters({ search: e.target.value })} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Building2 size={28} />} title="No companies yet" hint="Create your first opportunity to start building your pipeline."
          action={<Button onClick={() => setAdding(true)}><Plus size={16} /> New opportunity</Button>} />
      ) : (
        <Table>
          <THead><TR><TH>Company</TH><TH>Industry</TH><TH>Opportunities</TH><TH>Contacts</TH><TH>Last activity</TH></TR></THead>
          <TBody>
            {rows.slice(0, 300).map((r) => (
              <TR key={r.id} onClick={() => setOpenId(r.lastOppId)}>
                <TD className="font-medium text-ink">{r.name}</TD>
                <TD>{r.industry ?? '—'}</TD>
                <TD>{r.opps}</TD>
                <TD>{r.contacts}</TD>
                <TD>{fmtDate(r.lastActivity)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <OpportunityDialog oppId={openId} onClose={() => setOpenId(null)} />
      <AddOpportunityDialog open={adding} onClose={() => setAdding(false)} onCreated={(id) => setOpenId(id)} />
    </div>
  )
}
