import { create } from 'zustand'
import type { SelectedObject, FrequencyBand } from '@/types'

interface SceneState {
  selectedObject: SelectedObject | null
  currentBand: FrequencyBand
  cameraPosition: [number, number, number]
}

interface SceneActions {
  setSelectedObject: (obj: SelectedObject | null) => void
  clearSelection: () => void
  setCurrentBand: (band: FrequencyBand) => void
  resetCamera: () => void
}

const useSceneStore = create<SceneState & SceneActions>()((set) => ({
  selectedObject: null,
  currentBand: '1kHz' as FrequencyBand,
  cameraPosition: [0, 8, 12],
  setSelectedObject: (obj) => set({ selectedObject: obj }),
  clearSelection: () => set({ selectedObject: null }),
  setCurrentBand: (band) => set({ currentBand: band }),
  resetCamera: () => set({ cameraPosition: [0, 8, 12] }),
}))

export default useSceneStore
