import { CalendarRange } from 'lucide-react'
import { Dropdown } from './Dropdown'
import { fmtMonth } from '@/lib/format'

export function MonthRange({
  months, from, to, onChange,
}: {
  months: string[]
  from: string
  to: string
  onChange: (from: string, to: string) => void
}) {
  const monthOpts = months.map((m) => ({ value: m, label: fmtMonth(m) }))
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-line bg-bg-elev px-2.5 py-1">
      <CalendarRange size={15} className="text-ink-mute" />
      <Dropdown
        size="sm" className="w-32 border-0 bg-transparent hover:bg-transparent"
        ariaLabel="From month"
        value={from}
        onChange={(v) => onChange(v, to)}
        options={[{ value: '', label: 'From start' }, ...monthOpts]}
      />
      <span className="text-ink-mute">–</span>
      <Dropdown
        size="sm" className="w-32 border-0 bg-transparent hover:bg-transparent"
        ariaLabel="To month"
        value={to}
        onChange={(v) => onChange(from, v)}
        options={[{ value: '', label: 'To latest' }, ...monthOpts]}
      />
    </div>
  )
}
