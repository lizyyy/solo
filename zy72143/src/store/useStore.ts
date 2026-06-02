import { create } from 'zustand'
import type { Track, AuditLog, TrackStatus } from '@/types'

interface AppState {
  tracks: Track[]
  selectedTrackId: number | null
  statusFilter: TrackStatus | 'all'
  searchQuery: string
  auditLogs: AuditLog[]
  trackAuditLogs: AuditLog[]
  isLoading: boolean
  isCleaning: boolean

  fetchTracks: () => Promise<void>
  selectTrack: (id: number | null) => void
  setStatusFilter: (filter: TrackStatus | 'all') => void
  setSearchQuery: (query: string) => void
  updateTrack: (id: number, data: { status?: TrackStatus; operatorNote?: string; processedBy?: string }) => Promise<void>
  runCleaning: () => Promise<void>
  importSampleData: () => Promise<void>
  fetchAuditLogs: (limit?: number, offset?: number) => Promise<void>
  fetchTrackAuditLogs: (trackId: number) => Promise<void>
}

const API_BASE = '/api'

export const useStore = create<AppState>((set, get) => ({
  tracks: [],
  selectedTrackId: null,
  statusFilter: 'all',
  searchQuery: '',
  auditLogs: [],
  trackAuditLogs: [],
  isLoading: false,
  isCleaning: false,

  fetchTracks: async () => {
    set({ isLoading: true })
    try {
      const { statusFilter, searchQuery } = get()
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (searchQuery) params.set('search', searchQuery)
      const res = await fetch(`${API_BASE}/tracks?${params.toString()}`)
      const json = await res.json()
      if (json.success) set({ tracks: json.data })
    } finally {
      set({ isLoading: false })
    }
  },

  selectTrack: (id) => {
    set({ selectedTrackId: id })
    if (id) get().fetchTrackAuditLogs(id)
  },

  setStatusFilter: (filter) => {
    set({ statusFilter: filter })
    get().fetchTracks()
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query })
  },

  updateTrack: async (id, data) => {
    const res = await fetch(`${API_BASE}/tracks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (json.success) {
      get().fetchTracks()
      if (get().selectedTrackId === id) get().fetchTrackAuditLogs(id)
    }
  },

  runCleaning: async () => {
    set({ isCleaning: true })
    try {
      const res = await fetch(`${API_BASE}/tracks/clean`, { method: 'POST' })
      const json = await res.json()
      if (json.success) get().fetchTracks()
    } finally {
      set({ isCleaning: false })
    }
  },

  importSampleData: async () => {
    const res = await fetch(`${API_BASE}/import/sample`, { method: 'POST' })
    const json = await res.json()
    if (json.success) {
      await get().fetchTracks()
      await get().runCleaning()
    }
  },

  fetchAuditLogs: async (limit = 50, offset = 0) => {
    const res = await fetch(`${API_BASE}/audit-logs?limit=${limit}&offset=${offset}`)
    const json = await res.json()
    if (json.success) set({ auditLogs: json.data })
  },

  fetchTrackAuditLogs: async (trackId) => {
    const res = await fetch(`${API_BASE}/audit-logs?trackId=${trackId}&limit=50`)
    const json = await res.json()
    if (json.success) set({ trackAuditLogs: json.data })
  },
}))
