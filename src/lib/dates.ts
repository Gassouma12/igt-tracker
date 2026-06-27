// Month-range helpers shared by the pipeline and performance filters.

import type { GoalCadence } from '@/data/types'

export function monthKey(d: string | null | undefined): string | null {
  return d && d.length >= 7 ? d.slice(0, 7) : null
}

/** Distinct 'YYYY-MM' months present in the given dates, ascending. */
export function availableMonths(dates: (string | null | undefined)[]): string[] {
  const set = new Set<string>()
  for (const d of dates) {
    const m = monthKey(d)
    if (m) set.add(m)
  }
  return [...set].sort()
}

/** Inclusive range test; empty from/to means open-ended on that side. */
export function inMonthRange(d: string | null | undefined, from: string, to: string): boolean {
  const m = monthKey(d)
  if (!m) return false
  if (from && m < from) return false
  if (to && m > to) return false
  return true
}

// ---- goal cadences -------------------------------------------------------
// Goals can be weekly / monthly / semester. Each goal stores a period KEY that
// resolves to a concrete date window so "done" is measured within that window.

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => d.toISOString().slice(0, 10)

/** ISO-8601 week number of a date (weeks start Monday). */
export function isoWeek(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7 // Sun=7
  t.setUTCDate(t.getUTCDate() + 4 - day) // nearest Thursday
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return { year: t.getUTCFullYear(), week }
}

/** The period key for `date` under a cadence: '2026-S1' | '2026-06' | '2026-W26'. */
export function currentPeriod(cadence: GoalCadence, date = new Date()): string {
  const y = date.getFullYear()
  if (cadence === 'monthly') return `${y}-${pad(date.getMonth() + 1)}`
  if (cadence === 'weekly') { const { year, week } = isoWeek(date); return `${year}-W${pad(week)}` }
  return `${y}-S${date.getMonth() < 6 ? 1 : 2}`
}

/** Concrete [from,to] (inclusive, 'YYYY-MM-DD') for a cadence + period key. */
export function periodRange(cadence: GoalCadence, period: string): { from: string; to: string } {
  if (cadence === 'monthly') {
    const [y, m] = period.split('-').map(Number)
    return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) }
  }
  if (cadence === 'weekly') {
    const [y, w] = period.split('-W').map(Number)
    // Monday of ISO week w in year y
    const jan4 = new Date(y, 0, 4)
    const mondayW1 = new Date(jan4)
    mondayW1.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1))
    const from = new Date(mondayW1)
    from.setDate(mondayW1.getDate() + (w - 1) * 7)
    const to = new Date(from)
    to.setDate(from.getDate() + 6)
    return { from: iso(from), to: iso(to) }
  }
  const [y, s] = period.split('-S').map(Number)
  return s === 1 ? { from: `${y}-01-01`, to: `${y}-06-30` } : { from: `${y}-07-01`, to: `${y}-12-31` }
}

/** Human label for a period key, e.g. 'Jun 2026', 'Week 26 · 2026', '2026 S1'. */
export function periodLabel(cadence: GoalCadence, period: string): string {
  if (cadence === 'monthly') return fmtPeriodMonth(period)
  if (cadence === 'weekly') { const [y, w] = period.split('-W'); return `Week ${Number(w)} · ${y}` }
  const [y, s] = period.split('-S')
  return `${y} S${s}`
}

function fmtPeriodMonth(period: string): string {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

/** A few recent/current/upcoming period keys for a cadence (for a picker). */
export function periodOptions(cadence: GoalCadence, around = new Date()): string[] {
  if (cadence === 'semester') {
    const y = around.getFullYear()
    return [`${y}-S1`, `${y}-S2`]
  }
  const step = cadence === 'weekly' ? 7 : 30
  const out: string[] = []
  for (let i = -2; i <= 2; i++) {
    const d = new Date(around)
    d.setDate(around.getDate() + i * step)
    const p = currentPeriod(cadence, d)
    if (!out.includes(p)) out.push(p)
  }
  return out
}

/** Inclusive day-range test against 'YYYY-MM-DD' bounds. */
export function inDayRange(d: string | null | undefined, from: string, to: string): boolean {
  if (!d) return false
  const day = d.slice(0, 10)
  return day >= from && day <= to
}
