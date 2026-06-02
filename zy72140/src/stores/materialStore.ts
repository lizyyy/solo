import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Material } from '@/types';
import { seedMaterials } from '@/data/seedData';

interface MaterialState {
  materials: Material[];
  selectedScheduleId: string | null;
  addMaterial: (material: Material) => void;
  updateMaterial: (id: string, updates: Partial<Material>) => void;
  removeMaterial: (id: string) => void;
  setSelectedScheduleId: (id: string | null) => void;
  getMaterialsByScheduleId: (id: string) => Material[];
}

export const useMaterialStore = create<MaterialState>()(
  persist(
    (set, get) => ({
      materials: [],
      selectedScheduleId: null,
      addMaterial: (material) =>
        set((state) => ({ materials: [...state.materials, material] })),
      updateMaterial: (id, updates) =>
        set((state) => ({
          materials: state.materials.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        })),
      removeMaterial: (id) =>
        set((state) => ({
          materials: state.materials.filter((m) => m.id !== id),
        })),
      setSelectedScheduleId: (id) => set({ selectedScheduleId: id }),
      getMaterialsByScheduleId: (id) =>
        get().materials.filter((m) => m.scheduleId === id),
    }),
    {
      name: 'festival-materials',
      merge: (persistedState, currentState) => {
        const merged = { ...currentState, ...(persistedState as Partial<MaterialState>) };
        if (merged.materials.length === 0) {
          merged.materials = seedMaterials;
        }
        return merged;
      },
    }
  )
);
