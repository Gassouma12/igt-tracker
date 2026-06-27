// Session. In mock mode it holds the chosen user id (persisted). When real
// Supabase Auth is enabled, currentUserId tracks the auth session's user id
// (= the profile row id in `users`), and logout signs out of Supabase. The rest
// of the app just reads useCurrentUser() and is unaffected by which mode is on.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useDB } from '@/data/store'
import { supabase, useSupabaseAuth } from '@/lib/supabase'
import type { User } from '@/data/types'

interface SessionState {
  currentUserId: string | null
  login: (userId: string) => void // mock-mode quick sign-in
  logout: () => void
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      currentUserId: null,
      login: (userId) => set({ currentUserId: userId }),
      logout: () => {
        if (useSupabaseAuth && supabase) void supabase.auth.signOut()
        set({ currentUserId: null })
      },
    }),
    { name: 'igt.session' },
  ),
)

// Keep the session id in lock-step with the Supabase auth session.
if (useSupabaseAuth && supabase) {
  supabase.auth.getSession().then(({ data }) => {
    useSession.setState({ currentUserId: data.session?.user.id ?? null })
  })
  supabase.auth.onAuthStateChange((_event, session) => {
    useSession.setState({ currentUserId: session?.user.id ?? null })
  })
}

/** Reactive current user (re-renders if the user record itself changes). */
export function useCurrentUser(): User | null {
  const id = useSession((s) => s.currentUserId)
  return useDB((s) => s.users.find((u) => u.id === id) ?? null)
}
