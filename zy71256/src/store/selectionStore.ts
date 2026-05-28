import { create } from 'zustand';

interface SelectionStore {
  selectedPinId: string | null;
  hoveredPinId: string | null;
  focusedConflictId: string | null;
  selectPin: (pinId: string | null) => void;
  hoverPin: (pinId: string | null) => void;
  focusConflict: (conflictId: string | null) => void;
}

export const useSelectionStore = create<SelectionStore>((set) => ({
  selectedPinId: null,
  hoveredPinId: null,
  focusedConflictId: null,
  selectPin: (pinId) => set({ selectedPinId: pinId, focusedConflictId: null }),
  hoverPin: (pinId) => set({ hoveredPinId: pinId }),
  focusConflict: (conflictId) => set({ focusedConflictId: conflictId }),
}));
