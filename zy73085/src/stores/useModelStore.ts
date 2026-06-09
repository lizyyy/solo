import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ModelAnnotation } from "@/types";
import { mockAnnotations } from "@/data/mockData";

interface ModelState {
  annotations: ModelAnnotation[];
  activeFloor: string;
  selectedId: string | null;
  addAnnotation: (a: Omit<ModelAnnotation, "id" | "createdAt" | "updatedAt">) => ModelAnnotation;
  updateAnnotation: (id: string, patch: Partial<ModelAnnotation>) => void;
  removeAnnotation: (id: string) => void;
  setActiveFloor: (floor: string) => void;
  setSelected: (id: string | null) => void;
  linkMinutes: (annotationId: string, minutesId: string | null) => void;
  floors: string[];
  resetMock: () => void;
}

export const useModelStore = create<ModelState>()(
  persist(
    (set, get) => {
      const initial = mockAnnotations;
      const floors = Array.from(new Set(initial.map((a) => a.floor))).sort();
      return {
        annotations: initial,
        activeFloor: floors[0] || "A栋-1层",
        selectedId: null,
        floors,
        addAnnotation: (a) => {
          const now = new Date().toISOString();
          const newA: ModelAnnotation = {
            ...a,
            id: `ANN_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            createdAt: now,
            updatedAt: now,
          };
          set({
            annotations: [...get().annotations, newA],
            floors: Array.from(new Set([...get().floors, newA.floor])).sort(),
          });
          return newA;
        },
        updateAnnotation: (id, patch) =>
          set({
            annotations: get().annotations.map((a) =>
              a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a
            ),
          }),
        removeAnnotation: (id) =>
          set({ annotations: get().annotations.filter((a) => a.id !== id) }),
        setActiveFloor: (floor) => set({ activeFloor: floor }),
        setSelected: (id) => set({ selectedId: id }),
        linkMinutes: (annotationId, minutesId) =>
          set({
            annotations: get().annotations.map((a) =>
              a.id === annotationId
                ? { ...a, minutesId, updatedAt: new Date().toISOString() }
                : a
            ),
          }),
        resetMock: () =>
          set({
            annotations: mockAnnotations,
            activeFloor: floors[0],
            selectedId: null,
            floors,
          }),
      };
    },
    { name: "sgr-model-store" }
  )
);
