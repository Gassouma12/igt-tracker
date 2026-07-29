import { create } from 'zustand'

export type ToastTone = 'error' | 'info' | 'success'
export type Toast = { id: string; message: string; tone: ToastTone }

type ToastState = {
  toasts: Toast[]
  push: (message: string, tone?: ToastTone) => void
  dismiss: (id: string) => void
}

// Minimal toast store — surfaces things the user must not miss (e.g. a write
// that failed to reach the server). No provider needed; a <Toaster/> at the app
// root renders whatever lands here, and `toast.*` lets non-React code push.
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (message, tone = 'info') => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }))
    // Auto-dismiss; errors linger longer so they aren't missed.
    setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      tone === 'error' ? 8000 : 4000,
    )
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  error: (message: string) => useToasts.getState().push(message, 'error'),
  info: (message: string) => useToasts.getState().push(message, 'info'),
  success: (message: string) => useToasts.getState().push(message, 'success'),
}
