import {
  Area, AreaChart, Bar, BarChart, Cell, Funnel, FunnelChart, LabelList,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { OpportunityStatus } from '@/data/types'
import { STATUS_STYLE } from '@/components/ui/StatusBadge'
import { fmtMonth, fmtMoney, fmtNum, fmtPct } from '@/lib/format'

const AXIS = { fontSize: 11, fill: 'var(--ink-mute)' }
const GRID = 'var(--line)'

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      {children}
    </div>
  )
}

// ---- Funnel --------------------------------------------------------------
export function FunnelView({ data }: { data: { stage: OpportunityStatus; count: number }[] }) {
  const shaped = data.map((d) => ({ ...d, name: d.stage, fill: STATUS_STYLE[d.stage].dot }))
  return (
    <ResponsiveContainer width="100%" height={300}>
      <FunnelChart>
        <Tooltip
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TipBox>
                <p className="font-medium text-ink">{payload[0].payload.stage}</p>
                <p className="text-ink-dim">{fmtNum(payload[0].payload.count)} reached</p>
              </TipBox>
            ) : null
          }
        />
        <Funnel dataKey="count" data={shaped} isAnimationActive={false}>
          <LabelList position="right" fill="var(--ink-dim)" stroke="none" dataKey="stage" fontSize={11} />
          <LabelList position="left" fill="var(--ink)" stroke="none" dataKey="count" fontSize={12} />
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
  )
}

// ---- Conversion bars -----------------------------------------------------
export function ConversionBars({ data }: { data: { from: OpportunityStatus; to: OpportunityStatus; rate: number }[] }) {
  const shaped = data.map((d) => ({ label: `${shortStage(d.from)} → ${shortStage(d.to)}`, rate: d.rate }))
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={shaped} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <XAxis dataKey="label" tick={AXIS} interval={0} angle={-18} textAnchor="end" height={60} stroke={GRID} />
        <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={AXIS} stroke={GRID} />
        <Tooltip
          cursor={{ fill: 'var(--surface-2)' }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TipBox>
                <p className="font-medium text-ink">{payload[0].payload.label}</p>
                <p className="text-ink-dim">{fmtPct(payload[0].payload.rate, 1)} conversion</p>
              </TipBox>
            ) : null
          }
        />
        <Bar dataKey="rate" radius={[6, 6, 0, 0]} fill="var(--brand)" isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---- Ranking (horizontal) ------------------------------------------------
export function RankingBars({ data, dataKey = 'outreaches', color = 'var(--accent)', label, format = fmtNum }: {
  data: { name: string }[]
  dataKey?: string
  color?: string
  label?: string
  format?: (n: number) => string
}) {
  // Sort by the chosen metric so the ranking reflects the selected criteria.
  const num = (r: { name: string }) => Number((r as Record<string, unknown>)[dataKey] ?? 0)
  const shaped = [...data].sort((a, b) => num(b) - num(a)).slice(0, 8)
  return (
    <ResponsiveContainer width="100%" height={Math.max(shaped.length * 38, 120)}>
      <BarChart data={shaped} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" tick={AXIS} stroke={GRID} tickFormatter={(v) => format(Number(v))} />
        <YAxis type="category" dataKey="name" tick={AXIS} width={110} stroke={GRID} />
        <Tooltip
          cursor={{ fill: 'var(--surface-2)' }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TipBox>
                <p className="font-medium text-ink">{payload[0].payload.name}</p>
                <p className="text-ink-dim">{format(Number(payload[0].value))} {label ?? dataKey}</p>
              </TipBox>
            ) : null
          }
        />
        <Bar dataKey={dataKey} radius={[0, 6, 6, 0]} isAnimationActive={false}>
          {shaped.map((_, i) => (
            <Cell key={i} fill={color} fillOpacity={1 - i * 0.07} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---- Timeline area -------------------------------------------------------
export function TimelineArea({ data }: { data: { month: string; outreaches: number; meetings: number; contracts: number; revenue?: number }[] }) {
  const hasRevenue = data.some((d) => (d.revenue ?? 0) > 0)
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <defs>
          <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.5} />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gMeet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.45} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--success)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" tickFormatter={fmtMonth} tick={AXIS} stroke={GRID} />
        <YAxis yAxisId="count" tick={AXIS} stroke={GRID} />
        {hasRevenue && <YAxis yAxisId="rev" orientation="right" tick={AXIS} stroke={GRID} tickFormatter={(v) => fmtMoney(Number(v))} width={56} />}
        <Tooltip
          cursor={{ stroke: 'var(--line)' }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TipBox>
                <p className="mb-1 font-medium text-ink">{fmtMonth(String(label))}</p>
                {payload.map((p) => (
                  <p key={p.name} className="text-ink-dim">
                    <span style={{ color: p.color }}>●</span> {p.name}: {p.name === 'revenue' ? fmtMoney(Number(p.value)) : fmtNum(Number(p.value))}
                  </p>
                ))}
              </TipBox>
            ) : null
          }
        />
        <Area yAxisId="count" type="monotone" dataKey="outreaches" stroke="var(--brand)" strokeWidth={2} fill="url(#gOut)" isAnimationActive={false} />
        <Area yAxisId="count" type="monotone" dataKey="meetings" stroke="var(--accent)" strokeWidth={2} fill="url(#gMeet)" isAnimationActive={false} />
        {hasRevenue && <Area yAxisId="rev" type="monotone" dataKey="revenue" stroke="var(--success)" strokeWidth={2} fill="url(#gRev)" isAnimationActive={false} />}
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ---- Conversion stat chips (milestone rates) -----------------------------
export function ConversionStats({ data }: { data: { label: string; rate: number }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {data.map((d) => (
        <div key={d.label} className="rounded-xl border border-line bg-bg-elev p-3 text-center">
          <p className="font-display text-xl font-bold text-ink">{fmtPct(d.rate, 0)}</p>
          <p className="mt-0.5 text-[11px] leading-tight text-ink-mute">{d.label}</p>
        </div>
      ))}
    </div>
  )
}

// ---- Pie breakdown -------------------------------------------------------
export function PieBreakdown({ data }: { data: { name: string; value: number; color: string }[] }) {
  const shown = data.filter((d) => d.value > 0)
  const total = shown.reduce((a, b) => a + b.value, 0) || 1
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={shown} dataKey="value" nameKey="name" innerRadius={48} outerRadius={84} paddingAngle={2} isAnimationActive={false} stroke="none">
            {shown.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TipBox>
                  <p className="font-medium text-ink">{payload[0].payload.name}</p>
                  <p className="text-ink-dim">{fmtNum(Number(payload[0].value))} · {fmtPct(Number(payload[0].value) / total, 1)}</p>
                </TipBox>
              ) : null
            }
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="w-full space-y-1.5 sm:w-48">
        {shown.map((d) => (
          <li key={d.name} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="flex-1 truncate text-ink-dim">{d.name}</span>
            <span className="text-ink-mute">{fmtPct(d.value / total, 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---- Histogram (vertical bars) ------------------------------------------
export function Histogram({ data, color = 'var(--brand)' }: { data: { label: string; value: number }[]; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <XAxis dataKey="label" tick={AXIS} interval={0} angle={-18} textAnchor="end" height={56} stroke={GRID} />
        <YAxis tick={AXIS} stroke={GRID} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: 'var(--surface-2)' }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TipBox>
                <p className="font-medium text-ink">{label}</p>
                <p className="text-ink-dim">{fmtNum(Number(payload[0].value))}</p>
              </TipBox>
            ) : null
          }
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} fill={color} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function shortStage(s: OpportunityStatus): string {
  return s
    .replace('Contract ', '')
    .replace('Meeting scheduled', 'Meeting')
    .replace('Prospect', 'Prosp.')
}
