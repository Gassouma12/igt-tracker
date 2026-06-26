import { useMemo } from 'react'
import { Download } from 'lucide-react'
import { useLC } from './useLC'
import { kpis, statusDistribution, timeline, FUNNEL } from '@/lib/metrics'
import { fmtMonth, fmtNum, fmtPct } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button, Card, SectionTitle, StatCard } from '@/components/ui/primitives'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table'

function toCSV(rows: string[][]): string {
  return rows.map((r) => r.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
}

export default function Reports() {
  const { lc, opportunities, activities, meetings, contracts, companyById, contactById, userById } = useLC()

  const data = useMemo(() => ({
    k: kpis(opportunities, activities, meetings, contracts),
    dist: statusDistribution(opportunities),
    tl: timeline(activities, meetings, contracts),
  }), [opportunities, activities, meetings, contracts])

  function exportCSV() {
    const header = ['Company', 'Owner', 'Contact', 'Stage', 'Created', 'Last activity', 'Next action', 'Next action date']
    const body = opportunities.map((o) => [
      companyById(o.companyId)?.name ?? '', userById(o.ownerId)?.name ?? '',
      contactById(o.contactId)?.name ?? '', o.status, o.createdAt ?? '',
      o.lastActivityAt ?? '', o.nextAction ?? '', o.nextActionDate ?? '',
    ])
    const blob = new Blob([toCSV([header, ...body])], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${lc?.name ?? 'LC'}-pipeline-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle={`${lc?.name ?? 'LC'} · pipeline summary`}
        actions={<Button variant="secondary" onClick={exportCSV}><Download size={16} /> Export CSV</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Opportunities" value={fmtNum(data.k.opportunities)} />
        <StatCard label="Outreaches" value={fmtNum(data.k.outreaches)} accent="var(--accent)" />
        <StatCard label="Meetings" value={fmtNum(data.k.meetings)} accent="var(--info)" />
        <StatCard label="Signed" value={fmtNum(data.k.signed)} accent="var(--success)" hint={`${fmtPct(data.k.conversion, 1)} conversion`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Pipeline by stage" subtitle="Current opportunity distribution" />
          <Table>
            <THead><TR><TH>Stage</TH><TH>Opportunities</TH><TH>Share</TH></TR></THead>
            <TBody>
              {[...FUNNEL, 'Lost'].map((s) => (
                <TR key={s}>
                  <TD><StatusBadge status={s as never} /></TD>
                  <TD className="text-ink">{fmtNum(data.dist[s as never])}</TD>
                  <TD>{fmtPct(data.k.opportunities ? data.dist[s as never] / data.k.opportunities : 0, 1)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>

        <Card>
          <SectionTitle title="Monthly activity" subtitle="Outreaches, meetings & contracts" />
          <Table>
            <THead><TR><TH>Month</TH><TH>Outreaches</TH><TH>Meetings</TH><TH>Contracts</TH></TR></THead>
            <TBody>
              {data.tl.map((p) => (
                <TR key={p.month}>
                  <TD className="text-ink">{fmtMonth(p.month)}</TD>
                  <TD>{fmtNum(p.outreaches)}</TD>
                  <TD>{fmtNum(p.meetings)}</TD>
                  <TD>{fmtNum(p.contracts)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
