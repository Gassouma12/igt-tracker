import { Database, RotateCcw } from 'lucide-react'
import { useDB } from '@/data/store'
import { fmtNum } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button, Card, SectionTitle } from '@/components/ui/primitives'

export default function Settings() {
  const db = useDB()
  const reset = useDB((s) => s.reset)

  const counts: [string, number][] = [
    ['Users', db.users.length], ['Local Committees', db.localCommittees.length],
    ['Companies', db.companies.length], ['Contacts', db.contacts.length],
    ['Opportunities', db.opportunities.length], ['Activities', db.activities.length],
    ['Meetings', db.meetings.length], ['Contracts', db.contracts.length],
  ]

  return (
    <div>
      <PageHeader title="Settings" subtitle="Platform configuration & data" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Data summary" subtitle="Records currently in the platform" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {counts.map(([label, n]) => (
              <div key={label} className="rounded-xl border border-line bg-bg-elev py-3 text-center">
                <p className="font-display text-xl font-bold text-ink">{fmtNum(n)}</p>
                <p className="text-[11px] text-ink-mute">{label}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Data source" subtitle="Local mock layer" />
          <div className="flex items-start gap-3 rounded-xl border border-line bg-bg-elev p-4">
            <Database size={18} className="mt-0.5 text-brand" />
            <div className="text-sm">
              <p className="text-ink">Local store (seeded from the iGT Master Sheet)</p>
              <p className="mt-1 text-ink-mute">
                Data is persisted to your browser. The repository layer is ready to swap for
                Supabase — DB, auth and storage — without UI changes.
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-danger/30 bg-danger/5 p-4">
            <div className="text-sm">
              <p className="font-medium text-ink">Reset demo data</p>
              <p className="text-ink-mute">Restore the original migrated seed and discard local edits.</p>
            </div>
            <Button variant="danger" onClick={() => { if (confirm('Reset all data to the original seed? Local edits will be lost.')) reset() }}>
              <RotateCcw size={15} /> Reset
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
