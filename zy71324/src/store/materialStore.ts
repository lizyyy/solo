import { create } from 'zustand'
import { Material, FrequencyBand, FREQUENCY_BANDS, MaterialType } from '@/types'
import { MOCK_MATERIALS } from '@/data/mockMaterials'

interface MaterialStore {
  materials: Material[]
  editingMaterial: Material | null
  isFormOpen: boolean
  gapPanelOpen: boolean

  setMaterials: (materials: Material[]) => void
  addMaterial: (material: Material) => void
  updateMaterial: (id: string, updates: Partial<Material>) => void
  removeMaterial: (id: string) => void
  setEditingMaterial: (material: Material | null) => void
  setIsFormOpen: (open: boolean) => void
  setGapPanelOpen: (open: boolean) => void

  createEmptyMaterial: () => Material
}

export const useMaterialStore = create<MaterialStore>((set, get) => ({
  materials: [...MOCK_MATERIALS],
  editingMaterial: null,
  isFormOpen: false,
  gapPanelOpen: false,

  setMaterials: (materials) => set({ materials }),
  addMaterial: (material) => set((s) => ({ materials: [...s.materials, material] })),
  updateMaterial: (id, updates) =>
    set((s) => ({
      materials: s.materials.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),
  removeMaterial: (id) => set((s) => ({ materials: s.materials.filter((m) => m.id !== id) })),
  setEditingMaterial: (material) => set({ editingMaterial: material, isFormOpen: !!material }),
  setIsFormOpen: (open) => set({ isFormOpen: open, editingMaterial: open ? get().editingMaterial : null }),
  setGapPanelOpen: (open) => set({ gapPanelOpen: open }),

  createEmptyMaterial: () => ({
    id: `mat-${Date.now()}`,
    name: '',
    type: 'absorption_board' as MaterialType,
    unitPrice: 0,
    coefficients: FREQUENCY_BANDS.reduce(
      (acc, freq) => ({ ...acc, [freq]: null as number | null }),
      {} as Record<FrequencyBand, number | null>,
    ),
    thickness: 50,
    notes: '',
  }),
}))
