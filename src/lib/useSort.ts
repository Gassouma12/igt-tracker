// Stackable multi-column sort. Clicking a header cycles asc → desc → off, and
// keeps prior sort keys so columns stack (the order shown as a small badge).
// Accessors return a comparable string|number per column (callers coerce nulls).

import { useMemo, useState } from 'react'

export type SortDir = 'asc' | 'desc'
export interface SortState { key: string; dir: SortDir }
export type Accessors<T> = Record<string, (row: T) => string | number>

function compare(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true })
}

export function useSort<T>(rows: T[], accessors: Accessors<T>) {
  const [sorts, setSorts] = useState<SortState[]>([])

  function toggle(key: string) {
    setSorts((prev) => {
      const i = prev.findIndex((s) => s.key === key)
      if (i === -1) return [...prev, { key, dir: 'asc' }]
      if (prev[i].dir === 'asc') {
        const next = [...prev]
        next[i] = { key, dir: 'desc' }
        return next
      }
      return prev.filter((s) => s.key !== key) // third click clears this key
    })
  }

  const sorted = useMemo(() => {
    if (!sorts.length) return rows
    return [...rows].sort((a, b) => {
      for (const s of sorts) {
        const acc = accessors[s.key]
        if (!acc) continue
        const c = compare(acc(a), acc(b))
        if (c !== 0) return s.dir === 'asc' ? c : -c
      }
      return 0
    })
    // accessors are stable per page; intentionally not a dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sorts])

  return { sorted, sorts, toggle }
}
