// Cross-page "focus a lead" coordination: notifications use this to pulse a row
// in the pipeline (highlightId) or open the lead detail anywhere (dialogOppId).

import { create } from 'zustand'

interface FocusState {
  highlightId: string | null
  dialogOppId: string | null
  setHighlight: (id: string | null) => void
  openLead: (id: string) => void
  closeLead: () => void
}

export const useFocus = create<FocusState>((set) => ({
  highlightId: null,
  dialogOppId: null,
  setHighlight: (id) => set({ highlightId: id }),
  openLead: (id) => set({ dialogOppId: id }),
  closeLead: () => set({ dialogOppId: null }),
}))
