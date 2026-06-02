import { create } from 'zustand'
import type { Location, LocationAlias, MergeSuggestion } from '@/types'
import { getDB, generateId, nowISO } from '@/services/db'
import { findMergeCandidates } from '@/utils/similarity'

interface LocationState {
  locations: Location[]
  aliases: LocationAlias[]
  mergeSuggestions: MergeSuggestion[]
  loadAll: () => Promise<void>
  addLocation: (location: Omit<Location, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Location>
  updateLocation: (id: string, patch: Partial<Location>) => Promise<void>
  deleteLocation: (id: string) => Promise<void>
  addAlias: (alias: Omit<LocationAlias, 'id' | 'recordedAt'>) => Promise<void>
  confirmMerge: (suggestionId: string) => Promise<void>
  rejectMerge: (suggestionId: string) => Promise<void>
  checkMergeSuggestions: (locationId: string) => Promise<void>
}

export const useLocationStore = create<LocationState>((set, get) => ({
  locations: [],
  aliases: [],
  mergeSuggestions: [],

  loadAll: async () => {
    const db = await getDB()
    const locations = await db.getAll('locations')
    const aliases = await db.getAll('locationAliases')
    const mergeSuggestions = await db.getAll('mergeSuggestions')
    set({ locations, aliases, mergeSuggestions })
  },

  addLocation: async (location) => {
    const db = await getDB()
    const id = generateId()
    const now = nowISO()
    const record: Location = { ...location, id, createdAt: now, updatedAt: now }
    await db.put('locations', record)
    set((state) => ({ locations: [...state.locations, record] }))
    return record
  },

  updateLocation: async (id, patch) => {
    const db = await getDB()
    const existing = await db.get('locations', id)
    if (!existing) return
    const updated: Location = { ...existing, ...patch, id, updatedAt: nowISO() }
    await db.put('locations', updated)
    set((state) => ({
      locations: state.locations.map((l) => (l.id === id ? updated : l)),
    }))
  },

  deleteLocation: async (id) => {
    const db = await getDB()
    await db.delete('locations', id)
    set((state) => ({
      locations: state.locations.filter((l) => l.id !== id),
    }))
  },

  addAlias: async (alias) => {
    const db = await getDB()
    const record: LocationAlias = { ...alias, id: generateId(), recordedAt: nowISO() }
    await db.put('locationAliases', record)
    set((state) => ({ aliases: [...state.aliases, record] }))
  },

  confirmMerge: async (suggestionId) => {
    const db = await getDB()
    const suggestion = await db.get('mergeSuggestions', suggestionId)
    if (!suggestion) return

    const updatedSuggestion: MergeSuggestion = {
      ...suggestion,
      resolved: true,
      accepted: true,
    }
    await db.put('mergeSuggestions', updatedSuggestion)

    const locA = await db.get('locations', suggestion.locationIdA)
    const locB = await db.get('locations', suggestion.locationIdB)
    if (locB) {
      const mergedLoc: Location = { ...locB, mergeStatus: '已归并', mergedIntoId: suggestion.locationIdA, updatedAt: nowISO() }
      await db.put('locations', mergedLoc)
    }

    set((state) => ({
      mergeSuggestions: state.mergeSuggestions.map((s) =>
        s.id === suggestionId ? updatedSuggestion : s
      ),
      locations: state.locations.map((l) =>
        l.id === suggestion.locationIdB
          ? { ...l, mergeStatus: '已归并' as const, mergedIntoId: suggestion.locationIdA, updatedAt: nowISO() }
          : l
      ),
    }))
  },

  rejectMerge: async (suggestionId) => {
    const db = await getDB()
    const suggestion = await db.get('mergeSuggestions', suggestionId)
    if (!suggestion) return

    const updatedSuggestion: MergeSuggestion = {
      ...suggestion,
      resolved: true,
      accepted: false,
    }
    await db.put('mergeSuggestions', updatedSuggestion)

    set((state) => ({
      mergeSuggestions: state.mergeSuggestions.map((s) =>
        s.id === suggestionId ? updatedSuggestion : s
      ),
    }))
  },

  checkMergeSuggestions: async (locationId) => {
    const { locations } = get()
    const target = locations.find((l) => l.id === locationId)
    if (!target) return

    const candidates = findMergeCandidates(
      target.canonicalName,
      locations
        .filter((l) => l.id !== locationId && l.mergeStatus !== '已归并')
        .map((l) => ({ id: l.id, name: l.canonicalName }))
    )

    const db = await getDB()
    const newSuggestions: MergeSuggestion[] = []

    for (const candidate of candidates) {
      const id = generateId()
      const suggestion: MergeSuggestion = {
        id,
        locationIdA: locationId,
        locationIdB: candidate.id,
        similarity: candidate.similarity,
        reason: `名称相似度 ${candidate.similarity.toFixed(2)}`,
        resolved: false,
        accepted: null,
      }
      await db.put('mergeSuggestions', suggestion)
      newSuggestions.push(suggestion)
    }

    if (newSuggestions.length > 0) {
      set((state) => ({
        mergeSuggestions: [...state.mergeSuggestions, ...newSuggestions],
      }))
    }
  },
}))
