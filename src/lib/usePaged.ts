import { useMemo, useState } from 'react'

/** Client-side pagination over an already-sorted/filtered array. */
export function usePaged<T>(rows: T[], pageSize = 25) {
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pageCount - 1) // clamp when rows shrink (filtering)
  const slice = useMemo(
    () => rows.slice(current * pageSize, current * pageSize + pageSize),
    [rows, current, pageSize],
  )
  return {
    slice,
    page: current,
    pageCount,
    total: rows.length,
    from: rows.length ? current * pageSize + 1 : 0,
    to: Math.min(current * pageSize + pageSize, rows.length),
    setPage,
  }
}
