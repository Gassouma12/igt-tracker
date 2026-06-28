import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fmtNum } from '@/lib/format'

/** "Showing a–b of total" + prev/next. Renders nothing when it all fits one page. */
export function Pagination({
  page, pageCount, from, to, total, onChange,
}: {
  page: number
  pageCount: number
  from: number
  to: number
  total: number
  onChange: (page: number) => void
}) {
  if (pageCount <= 1) return null
  const btn = 'grid h-8 w-8 place-items-center rounded-lg border border-line text-ink-dim transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <div className="mt-3 flex items-center justify-between gap-3 text-sm text-ink-mute">
      <span>Showing {fmtNum(from)}–{fmtNum(to)} of {fmtNum(total)}</span>
      <div className="flex items-center gap-2">
        <button className={btn} onClick={() => onChange(page - 1)} disabled={page <= 0} aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        <span className="tabular-nums text-ink-dim">{page + 1} / {pageCount}</span>
        <button className={btn} onClick={() => onChange(page + 1)} disabled={page >= pageCount - 1} aria-label="Next page">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
