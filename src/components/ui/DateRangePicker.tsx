// App-styled date-range picker: two side-by-side month calendars + a grouped
// shortcut rail (relative ranges, AIESEC semesters S1/S2, quarters Q1–Q4).
// Emits inclusive 'YYYY-MM-DD' bounds ('' = open on that side). Dependency-free.
import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarRange, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { operatingYear, quarterBounds, semesterBounds } from '@/lib/dates'

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)
const startOfWeek = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x } // Monday
const fmt = (s: string) => parse(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

type Range = [string, string] // ['' | 'YYYY-MM-DD', '' | 'YYYY-MM-DD']
type Shortcut = { label: string; get: () => Range }

// Grouped shortcuts. Semesters/quarters follow the AIESEC operating calendar
// (S1 Feb–Jul, S2 Aug–Jan) and are ALWAYS listed for the current operating year.
function shortcutGroups(): { title: string; items: Shortcut[] }[] {
  const y = operatingYear()
  const b = (r: { from: string; to: string }): Range => [r.from, r.to]
  return [
    {
      title: 'Relative',
      items: [
        { label: 'This Week', get: () => { const s = startOfWeek(new Date()); const e = new Date(s); e.setDate(s.getDate() + 6); return [iso(s), iso(e)] } },
        { label: 'Last Week', get: () => { const s = startOfWeek(new Date()); s.setDate(s.getDate() - 7); const e = new Date(s); e.setDate(s.getDate() + 6); return [iso(s), iso(e)] } },
        { label: 'Last 7 Days', get: () => { const e = new Date(); const s = new Date(); s.setDate(e.getDate() - 6); return [iso(s), iso(e)] } },
        { label: 'This Month', get: () => { const n = new Date(); return [iso(new Date(n.getFullYear(), n.getMonth(), 1)), iso(new Date(n.getFullYear(), n.getMonth() + 1, 0))] } },
        { label: 'Next Month', get: () => { const n = new Date(); return [iso(new Date(n.getFullYear(), n.getMonth() + 1, 1)), iso(new Date(n.getFullYear(), n.getMonth() + 2, 0))] } },
      ],
    },
    {
      title: `Semesters · ${y}`,
      items: [
        { label: 'S1 · Feb–Jul', get: () => b(semesterBounds(y, 1)) },
        { label: 'S2 · Aug–Jan', get: () => b(semesterBounds(y, 2)) },
      ],
    },
    {
      title: `Quarters · ${y}`,
      items: ([1, 2, 3, 4] as const).map((q) => ({
        label: `Q${q} · ${['Feb–Apr', 'May–Jul', 'Aug–Oct', 'Nov–Jan'][q - 1]}`,
        get: () => b(quarterBounds(y, q)),
      })),
    },
  ]
}

function Month({ base, from, to, hover, onPick, onHover }: {
  base: Date; from: string; to: string; hover: string
  onPick: (d: string) => void; onHover: (d: string) => void
}) {
  const y = base.getFullYear(), m = base.getMonth()
  const lead = (new Date(y, m, 1).getDay() + 6) % 7 // Monday-start blanks
  const days = new Date(y, m + 1, 0).getDate()
  const end = to || hover // preview end while choosing
  const inSel = (d: string) => from && end && d >= (from < end ? from : end) && d <= (from < end ? end : from)
  return (
    <div className="w-[15.75rem] shrink-0">
      <div className="mb-2 text-center text-sm font-semibold text-ink">
        {base.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-ink-mute">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: lead }).map((_, i) => <div key={`b${i}`} className="h-9" />)}
        {Array.from({ length: days }).map((_, i) => {
          const d = iso(new Date(y, m, i + 1))
          const isEnd = d === from || d === to
          const selected = inSel(d)
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPick(d)}
              onMouseEnter={() => onHover(d)}
              className={`mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-sm tabular-nums transition ${
                isEnd ? 'bg-brand font-semibold text-white'
                  : selected ? 'bg-brand/20 text-ink'
                    : 'text-ink-dim hover:bg-surface-2'}`}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function DateRangePicker({ from, to, onChange }: {
  from: string; to: string; onChange: (from: string, to: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [left, setLeft] = useState(() => (from ? addMonths(parse(from), 0) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const [hover, setHover] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const groups = useMemo(shortcutGroups, [])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const label = useMemo(() => {
    if (!from && !to) return 'All dates'
    if (from && to) return `${fmt(from)} – ${fmt(to)}`
    return from ? `From ${fmt(from)}` : `Until ${fmt(to)}`
  }, [from, to])

  const active = (r: Range) => from === r[0] && to === r[1]

  // Click logic: first click sets start (clears end); second sets end (ordered).
  function pick(d: string) {
    if (!from || (from && to)) { onChange(d, ''); setHover('') }
    else { const [a, b] = d < from ? [d, from] : [from, d]; onChange(a, b); setOpen(false) }
  }

  function applyShortcut(s: Shortcut) {
    const [a, b] = s.get()
    onChange(a, b)
    if (a) setLeft(parse(a))
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-xl border border-line bg-bg-elev px-2.5 py-1.5 text-sm text-ink-dim transition hover:border-brand/40"
      >
        <CalendarRange size={15} className="text-ink-mute" />
        {label}
        {(from || to) && (
          <X size={14} className="ml-1 text-ink-mute hover:text-danger" onClick={(e) => { e.stopPropagation(); onChange('', ''); }} />
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 flex max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-pop">
          <div className="mr-4 flex w-44 shrink-0 flex-col gap-3 overflow-y-auto border-r border-line pr-4">
            {groups.map((grp) => (
              <div key={grp.title}>
                <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-ink-mute">{grp.title}</p>
                <div className="flex flex-col gap-0.5">
                  {grp.items.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => applyShortcut(s)}
                      className={`rounded-lg px-2.5 py-1.5 text-left text-[13px] transition ${
                        active(s.get()) ? 'bg-brand/15 font-medium text-brand' : 'text-ink-dim hover:bg-surface-2 hover:text-ink'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => { onChange('', ''); setHover('') }}
              className="mt-auto rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink-mute transition hover:bg-surface-2 hover:text-danger"
            >
              Reset
            </button>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <button type="button" onClick={() => setLeft(addMonths(left, -1))} className="rounded-lg p-1 text-ink-mute hover:bg-surface-2"><ChevronLeft size={18} /></button>
              <button type="button" onClick={() => setLeft(addMonths(left, 1))} className="rounded-lg p-1 text-ink-mute hover:bg-surface-2"><ChevronRight size={18} /></button>
            </div>
            <div className="flex gap-5" onMouseLeave={() => setHover('')}>
              <Month base={left} from={from} to={to} hover={hover} onPick={pick} onHover={setHover} />
              <Month base={addMonths(left, 1)} from={from} to={to} hover={hover} onPick={pick} onHover={setHover} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
