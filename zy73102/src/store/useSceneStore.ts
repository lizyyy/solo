import { create } from 'zustand'

interface SceneState {
  selectedMaterialId: string | null
  selectedMaterialName: string | null
  isCameraAnimating: boolean
  highlightMaterialId: string | null
  setSelectedMaterial: (id: string | null, name: string | null) => void
  focusOnMaterial: (id: string, name: string) => void
  highlightMaterial: (id: string | null) => void
  clearSelection: () => void
  setCameraAnimating: (animating: boolean) => void
}

export const useSceneStore = create<SceneState>((set) => ({
  selectedMaterialId: null,
  selectedMaterialName: null,
  isCameraAnimating: false,
  highlightMaterialId: null,

  setSelectedMaterial: (id, name) => set({
    selectedMaterialId: id,
    selectedMaterialName: name,
  }),

  focusOnMaterial: (id, name) => set({
    selectedMaterialId: id,
    selectedMaterialName: name,
    isCameraAnimating: true,
    highlightMaterialId: id,
  }),

  highlightMaterial: (id) => set({
    highlightMaterialId: id,
  }),

  clearSelection: () => set({
    selectedMaterialId: null,
    selectedMaterialName: null,
    highlightMaterialId: null,
  }),

  setCameraAnimating: (animating) => set({
    isCameraAnimating: animating,
  }),
}))
