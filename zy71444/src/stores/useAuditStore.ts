import { create } from "zustand"
import type { AuditLogEntry, AuditContext, ViewSnapshot } from "../data/types"
import { useFilterStore } from "./useFilterStore"
import { useSelectionStore } from "./useSelectionStore"

interface AuditState {
  entries: AuditLogEntry[]
  restoredEntryId: string | null
  logAction: (action: string, summary: string) => void
  restoreEntry: (entryId: string) => void
  clearRestored: () => void
}

let idCounter = 0

export const useAuditStore = create<AuditState>((set, get) => ({
  entries: [],
  restoredEntryId: null,

  logAction: (action, summary) => {
    const filterState = useFilterStore.getState()
    const selectionState = useSelectionStore.getState()

    const context: AuditContext = {
      activeGreeks: [...filterState.activeGreeks],
      activeBuckets: [...filterState.activeBuckets],
      thresholdValue: filterState.thresholdValue,
      selectedClientId: selectionState.selectedExposure?.clientId ?? null,
    }

    const snapshot: ViewSnapshot = {
      cameraPosition: [0, 0, 0],
      cameraTarget: [0, 0, 0],
      filterState: { ...context },
      highlightedIds: selectionState.selectedExposure
        ? [selectionState.selectedExposure.clientId + "::" + selectionState.selectedExposure.bucketId]
        : [],
    }

    const entry: AuditLogEntry = {
      id: `audit-${++idCounter}-${Date.now()}`,
      timestamp: Date.now(),
      action,
      summary,
      context,
      snapshot,
    }

    set((state) => ({
      entries: [entry, ...state.entries].slice(0, 100),
    }))
  },

  restoreEntry: (entryId) => {
    const entry = get().entries.find((e) => e.id === entryId)
    if (!entry) return

    const filterStore = useFilterStore.getState()
    filterStore.setActiveGreeks(entry.context.activeGreeks)
    filterStore.setActiveBuckets(entry.context.activeBuckets)
    filterStore.setThreshold(entry.context.thresholdValue)

    set({ restoredEntryId: entryId })
  },

  clearRestored: () => set({ restoredEntryId: null }),
}))
