// Shared filter bar state (LC / member / status / date range / search) used by
// dashboards and the pipeline. Kept separate from data so filtering is cheap.

import { create } from 'zustand'
import type { OpportunityStatus } from '@/data/types'

export interface FilterState {
  search: string
  lcId: string | null
  ownerId: string | null
  status: OpportunityStatus | null
  from: string | null
  to: string | null
  set: (patch: Partial<Omit<FilterState, 'set' | 'clear'>>) => void
  clear: () => void
}

const EMPTY = { search: '', lcId: null, ownerId: null, status: null, from: null, to: null }

export const useFilters = create<FilterState>((set) => ({
  ...EMPTY,
  set: (patch) => set(patch),
  clear: () => set(EMPTY),
}))
