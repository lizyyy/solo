import { create } from 'zustand'
import type { SceneStore, SceneState, SceneData, Conflict } from '../types'
import { detectConflicts } from '../utils/conflictDetector'

const STORAGE_KEY = 'traffic-intersection-data'

const initialState: SceneState = {
  currentTime: 0,
  isPlaying: false,
  playSpeed: 1,
  totalDuration: 60,
  viewMode: '3d',
  filters: {
    showVehicles: true,
    showPedestrians: true,
    showTrafficLights: true,
    showAccidentPoints: true,
    showConflicts: true,
    showTrajectories: true,
  },
  selectedElement: null,
}

export const saveDataToStorage = (data: SceneData) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to save data to localStorage:', e)
  }
}

export const loadDataFromStorage = (): SceneData | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored) as SceneData
    }
  } catch (e) {
    console.error('Failed to load data from localStorage:', e)
  }
  return null
}

export const clearDataFromStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (e) {
    console.error('Failed to clear data from localStorage:', e)
  }
}

const useSceneStore = create<SceneStore>((set, get) => ({
  ...initialState,
  
  intersection: null,
  signalPhases: [],
  vehicles: [],
  pedestrians: [],
  accidentPoints: [],
  conflicts: [],
  
  setCurrentTime: (time) => set({ currentTime: time }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPlaySpeed: (playSpeed) => set({ playSpeed }),
  setTotalDuration: (totalDuration) => set({ totalDuration }),
  setViewMode: (viewMode) => set({ viewMode }),
  setFilters: (filters) => set((state) => ({ filters: { ...state.filters, ...filters } })),
  setSelectedElement: (selectedElement) => set({ selectedElement }),
  
  setIntersection: (intersection) => set({ intersection }),
  setSignalPhases: (signalPhases) => set({ signalPhases }),
  setVehicles: (vehicles) => set({ vehicles }),
  setPedestrians: (pedestrians) => set({ pedestrians }),
  setAccidentPoints: (accidentPoints) => set({ accidentPoints }),
  setConflicts: (conflicts) => set({ conflicts }),
  
  loadSceneData: (data: SceneData, persist = true) => {
    const conflicts: Conflict[] = detectConflicts(data)
    set({
      intersection: data.intersection,
      signalPhases: data.signalPhases,
      vehicles: data.vehicles,
      pedestrians: data.pedestrians,
      accidentPoints: data.accidentPoints,
      totalDuration: data.totalDuration,
      conflicts,
      currentTime: 0,
      isPlaying: false,
    })
    if (persist) {
      saveDataToStorage(data)
    }
  },
  
  resetScene: () => {
    const currentData = {
      intersection: get().intersection,
      signalPhases: get().signalPhases,
      vehicles: get().vehicles,
      pedestrians: get().pedestrians,
      accidentPoints: get().accidentPoints,
      totalDuration: get().totalDuration,
    }
    const conflicts = currentData.intersection ? detectConflicts(currentData as SceneData) : []
    set({
      ...initialState,
      intersection: get().intersection,
      signalPhases: get().signalPhases,
      vehicles: get().vehicles,
      pedestrians: get().pedestrians,
      accidentPoints: get().accidentPoints,
      totalDuration: get().totalDuration,
      conflicts,
    })
  },
  
  jumpToTime: (time) => set((state) => ({
    currentTime: Math.max(0, Math.min(time, state.totalDuration)),
    isPlaying: false,
  })),
}))

export default useSceneStore
