import { create } from 'zustand'

interface SceneState {
  selectedMaterialId: string | null
  selectedMaterialName: string | null
  isCameraAnimating: boolean
  setSelectedMaterial: (id: string | null, name?: string | null) => void
  focusOnMaterial: (id: string, name: string) => void
  clearSelection: () => void
  setCameraAnimating: (animating: boolean) => void
}

export const useSceneStore = create<SceneState>((set) => ({
  selectedMaterialId: null,
  selectedMaterialName: null,
  isCameraAnimating: false,
  setSelectedMaterial: (id, name = null) => set({
    selectedMaterialId: id,
    selectedMaterialName: name ?? id,
  }),
  focusOnMaterial: (id, name) => set({
    selectedMaterialId: id,
    selectedMaterialName: name,
    isCameraAnimating: true,
  }),
  clearSelection: () => set({
    selectedMaterialId: null,
    selectedMaterialName: null,
  }),
  setCameraAnimating: (animating) => set({
    isCameraAnimating: animating,
  }),
}))
