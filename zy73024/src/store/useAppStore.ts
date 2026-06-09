import { create } from 'zustand'
import type { Status, AnomalyType, ImpactLevel } from '../types'

interface AppState {
  searchQuery: string
  statusFilter: Status | 'all'
  anomalyTypeFilter: AnomalyType | 'all'
  impactLevelFilter: ImpactLevel | 'all'
  deliveryMode: boolean
  selectedPetId: string | null

  setSearchQuery: (q: string) => void
  setStatusFilter: (s: Status | 'all') => void
  setAnomalyTypeFilter: (t: AnomalyType | 'all') => void
  setImpactLevelFilter: (l: ImpactLevel | 'all') => void
  setDeliveryMode: (on: boolean) => void
  setSelectedPetId: (id: string | null) => void
  resetFilters: () => void
}

export const useAppStore = create<AppState>((set) => ({
  searchQuery: '',
  statusFilter: 'all',
  anomalyTypeFilter: 'all',
  impactLevelFilter: 'all',
  deliveryMode: false,
  selectedPetId: null,

  setSearchQuery: (q) => set({ searchQuery: q }),
  setStatusFilter: (s) => set({ statusFilter: s }),
  setAnomalyTypeFilter: (t) => set({ anomalyTypeFilter: t }),
  setImpactLevelFilter: (l) => set({ impactLevelFilter: l }),
  setDeliveryMode: (on) => set({ deliveryMode: on }),
  setSelectedPetId: (id) => set({ selectedPetId: id }),
  resetFilters: () =>
    set({
      searchQuery: '',
      statusFilter: 'all',
      anomalyTypeFilter: 'all',
      impactLevelFilter: 'all',
    }),
}))
