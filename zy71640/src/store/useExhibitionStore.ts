import { create } from 'zustand'
import type {
  Wall, Artwork, Light, VisitorPath, SafetyZone, Source, Conflict,
  ViewpointPreset, ValidationStatus, ConflictType
} from '@/types'
import { VIEWPOINT_PRESETS } from '@/types'
import {
  demoWalls, demoArtworks, demoLights, demoPaths,
  demoSafetyZones, demoSources, computeDemoConflicts, DEMO_EXHIBITION_ID
} from '@/data/mockData'

interface ExhibitionState {
  exhibitionId: string
  exhibitionName: string

  walls: Wall[]
  artworks: Artwork[]
  lights: Light[]
  paths: VisitorPath[]
  safetyZones: SafetyZone[]
  sources: Source[]
  conflicts: Conflict[]

  selectedId: string | null
  selectedType: 'artwork' | 'light' | 'path' | 'wall' | null

  currentViewpoint: ViewpointPreset
  cameraPosition: [number, number, number]
  cameraTarget: [number, number, number]

  playbackTime: number
  isPlaying: boolean
  playbackSpeed: number

  sidebarOpen: boolean
  showSafetyZones: boolean
  showPaths: boolean
  showLightRanges: boolean
  conflictFilter: ConflictType | 'all'

  loadDemoData: () => void
  setViewpoint: (v: ViewpointPreset) => void
  setCamera: (pos: [number, number, number], target: [number, number, number]) => void
  selectObject: (id: string | null, type: 'artwork' | 'light' | 'path' | 'wall' | null) => void
  updateArtworkPosition: (id: string, x: number, y: number, z: number) => void
  setPlaybackTime: (t: number) => void
  togglePlayback: () => void
  setPlaybackSpeed: (s: number) => void
  toggleSidebar: () => void
  toggleSafetyZones: () => void
  togglePaths: () => void
  toggleLightRanges: () => void
  setConflictFilter: (f: ConflictType | 'all') => void
  importData: (data: {
    walls?: Wall[]
    artworks?: Artwork[]
    lights?: Light[]
    paths?: VisitorPath[]
    safetyZones?: SafetyZone[]
    sources?: Source[]
  }) => void
  runConflictDetection: () => void
  resolveConflict: (id: string) => void
  getFilteredConflicts: () => Conflict[]
}

export const useExhibitionStore = create<ExhibitionState>((set, get) => ({
  exhibitionId: DEMO_EXHIBITION_ID,
  exhibitionName: '当代艺术展 · 春季',

  walls: [],
  artworks: [],
  lights: [],
  paths: [],
  safetyZones: [],
  sources: [],
  conflicts: [],

  selectedId: null,
  selectedType: null,

  currentViewpoint: 'free',
  cameraPosition: VIEWPOINT_PRESETS.free.position,
  cameraTarget: VIEWPOINT_PRESETS.free.target,

  playbackTime: 0,
  isPlaying: false,
  playbackSpeed: 1,

  sidebarOpen: true,
  showSafetyZones: true,
  showPaths: true,
  showLightRanges: true,
  conflictFilter: 'all',

  loadDemoData: () => {
    const state = get()
    if (state.artworks.length > 0) return
    const conflicts = computeDemoConflicts(demoArtworks, demoLights, demoPaths, demoSafetyZones)
    set({
      walls: demoWalls,
      artworks: demoArtworks,
      lights: demoLights,
      paths: demoPaths,
      safetyZones: demoSafetyZones,
      sources: demoSources,
      conflicts,
    })
  },

  setViewpoint: (v) => {
    const preset = VIEWPOINT_PRESETS[v]
    set({
      currentViewpoint: v,
      cameraPosition: preset.position,
      cameraTarget: preset.target,
    })
  },

  setCamera: (pos, target) => {
    set({ cameraPosition: pos, cameraTarget: target, currentViewpoint: 'free' })
  },

  selectObject: (id, type) => {
    set({ selectedId: id, selectedType: type })
  },

  updateArtworkPosition: (id, x, y, z) => {
    set((state) => ({
      artworks: state.artworks.map((a) =>
        a.id === id ? { ...a, posX: x, posY: y, posZ: z } : a
      ),
    }))
    get().runConflictDetection()
  },

  setPlaybackTime: (t) => set({ playbackTime: t }),
  togglePlayback: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setPlaybackSpeed: (s) => set({ playbackSpeed: s }),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleSafetyZones: () => set((s) => ({ showSafetyZones: !s.showSafetyZones })),
  togglePaths: () => set((s) => ({ showPaths: !s.showPaths })),
  toggleLightRanges: () => set((s) => ({ showLightRanges: !s.showLightRanges })),
  setConflictFilter: (f) => set({ conflictFilter: f }),

  importData: (data) => {
    set((state) => ({
      walls: [...state.walls, ...(data.walls || [])],
      artworks: [...state.artworks, ...(data.artworks || [])],
      lights: [...state.lights, ...(data.lights || [])],
      paths: [...state.paths, ...(data.paths || [])],
      safetyZones: [...state.safetyZones, ...(data.safetyZones || [])],
      sources: [...state.sources, ...(data.sources || [])],
    }))
    get().runConflictDetection()
  },

  runConflictDetection: () => {
    const state = get()
    const conflicts = computeDemoConflicts(
      state.artworks, state.lights, state.paths, state.safetyZones
    )
    set({ conflicts })
  },

  resolveConflict: (id) => {
    set((state) => ({
      conflicts: state.conflicts.map((c) =>
        c.id === id ? { ...c, resolvedAt: new Date().toISOString() } : c
      ),
    }))
  },

  getFilteredConflicts: () => {
    const state = get()
    const filtered = state.conflictFilter === 'all'
      ? state.conflicts
      : state.conflicts.filter((c) => c.type === state.conflictFilter)
    return filtered.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })
  },
}))
