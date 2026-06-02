import { create } from 'zustand'
import type { Location, Feedback, Scheme, Report, ManualNote, Stats } from '../types'

interface AppState {
  stats: Stats | null
  locations: Location[]
  feedback: Feedback[]
  schemes: Scheme[]
  reports: Report[]
  loading: Record<string, boolean>
  error: string | null

  setStats: (stats: Stats) => void
  setLocations: (locations: Location[]) => void
  setFeedback: (feedback: Feedback[]) => void
  setSchemes: (schemes: Scheme[]) => void
  setReports: (reports: Report[]) => void
  addLocation: (location: Location) => void
  updateLocation: (location: Location) => void
  addFeedback: (item: Feedback) => void
  updateFeedback: (item: Feedback) => void
  addScheme: (scheme: Scheme) => void
  updateScheme: (scheme: Scheme) => void
  addReport: (report: Report) => void
  setLoading: (key: string, value: boolean) => void
  setError: (error: string | null) => void
}

export const useStore = create<AppState>((set) => ({
  stats: null,
  locations: [],
  feedback: [],
  schemes: [],
  reports: [],
  loading: {},
  error: null,

  setStats: (stats) => set({ stats }),
  setLocations: (locations) => set({ locations }),
  setFeedback: (feedback) => set({ feedback }),
  setSchemes: (schemes) => set({ schemes }),
  setReports: (reports) => set({ reports }),

  addLocation: (location) =>
    set((state) => ({ locations: [location, ...state.locations] })),
  updateLocation: (location) =>
    set((state) => ({
      locations: state.locations.map((l) => (l.id === location.id ? location : l)),
    })),

  addFeedback: (item) =>
    set((state) => ({ feedback: [item, ...state.feedback] })),
  updateFeedback: (item) =>
    set((state) => ({
      feedback: state.feedback.map((f) => (f.id === item.id ? item : f)),
    })),

  addScheme: (scheme) =>
    set((state) => ({ schemes: [scheme, ...state.schemes] })),
  updateScheme: (scheme) =>
    set((state) => ({
      schemes: state.schemes.map((s) => (s.id === scheme.id ? scheme : s)),
    })),

  addReport: (report) =>
    set((state) => ({ reports: [report, ...state.reports] })),

  setLoading: (key, value) =>
    set((state) => ({ loading: { ...state.loading, [key]: value } })),
  setError: (error) => set({ error }),
}))
