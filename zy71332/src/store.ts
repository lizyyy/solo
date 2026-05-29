import { create } from 'zustand'
import type { Reservation, Room, SwapLog, ConflictResult, NoiseAdjacencyResult, DetectionReport } from '../shared/types'

interface Filters {
  room: string
  instrument: string
  person: string
  dateFrom: string
  dateTo: string
  noiseLevel: string
}

interface StoreState {
  reservations: Reservation[]
  rooms: Room[]
  swapLogs: SwapLog[]
  conflicts: ConflictResult[]
  noiseRisks: NoiseAdjacencyResult[]
  reports: DetectionReport[]
  filters: Filters
  loading: boolean
  fetchReservations: () => Promise<void>
  fetchRooms: () => Promise<void>
  fetchSwapLogs: () => Promise<void>
  createReservation: (data: Partial<Reservation>) => Promise<void>
  updateReservation: (id: number, data: Partial<Reservation>) => Promise<void>
  deleteReservation: (id: number) => Promise<void>
  swapRoom: (id: number, newRoom: string, reason: string) => Promise<void>
  detectConflicts: () => Promise<void>
  detectNoiseAdjacency: () => Promise<void>
  fetchReports: () => Promise<void>
  saveReport: (data: { name: string; conflictCount: number; adjacencyRiskCount: number; details: string }) => Promise<void>
  setFilters: (filters: Partial<Filters>) => void
  exportReservations: () => void
  exportSwapLogs: () => void
  exportNotification: () => void
}

const buildFilterQuery = (filters: Filters) => {
  const params = new URLSearchParams()
  if (filters.room) params.set('room', filters.room)
  if (filters.instrument) params.set('instrument', filters.instrument)
  if (filters.person) params.set('person', filters.person)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.noiseLevel) params.set('noiseLevel', filters.noiseLevel)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const useStore = create<StoreState>((set, get) => ({
  reservations: [],
  rooms: [],
  swapLogs: [],
  conflicts: [],
  noiseRisks: [],
  reports: [],
  filters: { room: '', instrument: '', person: '', dateFrom: '', dateTo: '', noiseLevel: '' },
  loading: false,

  fetchReservations: async () => {
    set({ loading: true })
    const qs = buildFilterQuery(get().filters)
    const res = await fetch(`/api/reservations${qs}`)
    const data = await res.json()
    set({ reservations: data, loading: false })
  },

  fetchRooms: async () => {
    const res = await fetch('/api/rooms')
    const data = await res.json()
    set({ rooms: data })
  },

  fetchSwapLogs: async () => {
    const res = await fetch('/api/swap-logs')
    const data = await res.json()
    set({ swapLogs: data })
  },

  createReservation: async (data) => {
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) await get().fetchReservations()
  },

  updateReservation: async (id, data) => {
    const res = await fetch(`/api/reservations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) await get().fetchReservations()
  },

  deleteReservation: async (id) => {
    const res = await fetch(`/api/reservations/${id}`, { method: 'DELETE' })
    if (res.ok) await get().fetchReservations()
  },

  swapRoom: async (id, newRoom, reason) => {
    const res = await fetch(`/api/reservations/${id}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newRoom, reason }),
    })
    if (res.ok) {
      await get().fetchReservations()
      await get().fetchSwapLogs()
    }
  },

  detectConflicts: async () => {
    set({ loading: true })
    const res = await fetch('/api/detect/conflicts', { method: 'POST' })
    const data = await res.json()
    set({ conflicts: data, loading: false })
  },

  detectNoiseAdjacency: async () => {
    set({ loading: true })
    const res = await fetch('/api/detect/noise-adjacency', { method: 'POST' })
    const data = await res.json()
    set({ noiseRisks: data, loading: false })
  },

  fetchReports: async () => {
    const res = await fetch('/api/reports')
    const data = await res.json()
    set({ reports: data })
  },

  saveReport: async (data) => {
    await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await get().fetchReports()
  },

  setFilters: (partial) => {
    set((s) => ({ filters: { ...s.filters, ...partial } }))
  },

  exportReservations: () => {
    const qs = buildFilterQuery(get().filters)
    window.open(`/api/export/reservations${qs}`, '_blank')
  },

  exportSwapLogs: () => {
    window.open('/api/export/swap-logs', '_blank')
  },

  exportNotification: () => {
    window.open('/api/export/notification', '_blank')
  },
}))
