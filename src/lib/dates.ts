// Month-range helpers shared by the pipeline and performance filters.

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
