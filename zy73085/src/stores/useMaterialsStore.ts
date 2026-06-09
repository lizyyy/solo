import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MaterialBatch, MaterialDecision } from "@/types";
import { mockMaterials, mockAnnotations } from "@/data/mockData";
import { evaluateMaterialDecision } from "@/utils/materialDecision";

interface MaterialsState {
  batches: MaterialBatch[];
  selectedAnnotationId: string | null;
  addBatch: (b: Omit<MaterialBatch, "id" | "createdAt">) => MaterialBatch;
  updateBatch: (id: string, patch: Partial<MaterialBatch>) => void;
  removeBatch: (id: string) => void;
  setSelectedAnnotation: (id: string | null) => void;
  getDecision: (annotationId: string) => MaterialDecision;
  getBatchesForAnnotation: (annotationId: string) => MaterialBatch[];
  resetMock: () => void;
}

export const useMaterialsStore = create<MaterialsState>()(
  persist(
    (set, get) => ({
      batches: mockMaterials,
      selectedAnnotationId: null,
      addBatch: (b) => {
        const now = new Date().toISOString();
        const nb: MaterialBatch = {
          ...b,
          id: `MAT_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          createdAt: now,
        };
        set({ batches: [...get().batches, nb] });
        return nb;
      },
      updateBatch: (id, patch) =>
        set({ batches: get().batches.map((b) => (b.id === id ? { ...b, ...patch } : b)) }),
      removeBatch: (id) => set({ batches: get().batches.filter((b) => b.id !== id) }),
      setSelectedAnnotation: (id) => set({ selectedAnnotationId: id }),
      getDecision: (annotationId) => {
        const ann = mockAnnotations.find((a) => a.id === annotationId) ||
          get_annotation_fallback(annotationId);
        const related = get().batches.filter((b) => b.annotationId === annotationId);
        if (!ann) {
          return {
            decision: "evaluate",
            reason: "未找到标注信息，需人工评估",
            impactLevel: "warning",
          };
        }
        return evaluateMaterialDecision(ann, related);
      },
      getBatchesForAnnotation: (id) => get().batches.filter((b) => b.annotationId === id),
      resetMock: () => set({ batches: mockMaterials, selectedAnnotationId: null }),
    }),
    { name: "sgr-materials-store" }
  )
);

function get_annotation_fallback(id: string) {
  const found = mockAnnotations.find((a) => a.id === id);
  return found || null;
}
