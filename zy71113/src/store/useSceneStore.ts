import { create } from 'zustand'
import type { SceneStore, SceneState } from '../types'

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

const useSceneStore = create<SceneStore>((set) => ({
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
  
  resetScene: () => set({
    ...initialState,
  }),
  
  jumpToTime: (time) => set((state) => ({
    currentTime: Math.max(0, Math.min(time, state.totalDuration)),
    isPlaying: false,
  })),
}))

export default useSceneStore
