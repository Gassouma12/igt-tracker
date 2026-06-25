// Mock auth session. Holds the signed-in user id (persisted). Real Supabase
// auth later replaces login/logout bodies; the rest of the app reads
// useCurrentUser() and is unaffected.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useDB } from '@/data/store'
import type { User } from '@/data/types'

interface SessionState {
  currentUserId: string | null
  login: (userId: string) => void
  logout: () => void
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      currentUserId: null,
      login: (userId) => set({ currentUserId: userId }),
      logout: () => set({ currentUserId: null }),
    }),
    { name: 'igt.session' },
  ),
)

/** Reactive current user (re-renders if the user record itself changes). */
export function useCurrentUser(): User | null {
  const id = useSession((s) => s.currentUserId)
  return useDB((s) => s.users.find((u) => u.id === id) ?? null)
}
