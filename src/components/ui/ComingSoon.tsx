import { Hammer } from 'lucide-react'
import { PageHeader } from './PageHeader'
import { EmptyState } from './primitives'

export function ComingSoon({ title, note }: { title: string; note?: string }) {
  return (
    <div>
      <PageHeader title={title} subtitle="Part of the iGT platform roadmap" />
      <EmptyState
        icon={<Hammer size={28} />}
        title={`${title} — coming in the next pass`}
        hint={note ?? 'The data layer, RBAC and navigation for this section are wired. The full UI lands in a follow-up build.'}
      />
    </div>
  )
}
