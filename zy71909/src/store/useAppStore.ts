import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, AppActions, PitchDeviation, RecordingBatch, Note, DeviationCategory, Filters } from '../types';
import { voiceParts, students, batches, notes, deviations as initialDeviations } from '../data/mockData';
import { classifyAllDeviations } from '../utils/classification';

const initialDeviationsWithClassification = classifyAllDeviations(initialDeviations, batches);

const initialState: Omit<AppState, keyof AppActions> = {
  batches,
  students,
  voiceParts,
  deviations: initialDeviationsWithClassification,
  notes,
  selectedBatchId: batches[batches.length - 1]?.id || null,
  selectedDeviationId: null,
  sidebarOpen: false,
  entryPanelOpen: false,
  filters: {
    voicePartId: null,
    category: null,
    showAnomaliesOnly: false,
  },
};

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setSelectedBatchId: (id) => set({ selectedBatchId: id }),
      setSelectedDeviationId: (id) => set({ selectedDeviationId: id }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setEntryPanelOpen: (open) => set({ entryPanelOpen: open }),

      setFilters: (newFilters) =>
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        })),

      updateDeviation: (id, updates) =>
        set((state) => {
          const updatedDeviations = state.deviations.map((d) =>
            d.id === id
              ? { ...d, ...updates, updatedAt: new Date().toISOString() }
              : d
          );
          const reclassified = classifyAllDeviations(updatedDeviations, state.batches);
          return { deviations: reclassified };
        }),

      addDeviation: (deviation) =>
        set((state) => {
          const newDeviation: PitchDeviation = {
            ...deviation,
            id: `dev-${Date.now()}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          const updatedDeviations = [...state.deviations, newDeviation];
          const reclassified = classifyAllDeviations(updatedDeviations, state.batches);
          return { deviations: reclassified };
        }),

      addNote: (note) =>
        set((state) => ({
          notes: [
            ...state.notes,
            {
              ...note,
              id: `note-${Date.now()}`,
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      addBatch: (batch) =>
        set((state) => ({
          batches: [
            ...state.batches,
            {
              ...batch,
              id: `batch-${Date.now()}`,
            },
          ],
        })),

      markAsReviewed: (deviationId) =>
        set((state) => {
          const updatedDeviations = state.deviations.map((d) =>
            d.id === deviationId
              ? { ...d, reviewed: true, updatedAt: new Date().toISOString() }
              : d
          );
          const reclassified = classifyAllDeviations(updatedDeviations, state.batches);
          return { deviations: reclassified };
        }),

      toggleAnomaly: (deviationId, reason) =>
        set((state) => {
          const updatedDeviations = state.deviations.map((d) => {
            if (d.id !== deviationId) return d;
            const isAnomaly = !d.isAnomaly;
            return {
              ...d,
              isAnomaly,
              anomalyType: (isAnomaly ? 'manual' : undefined) as PitchDeviation['anomalyType'],
              anomalyReason: isAnomaly ? reason || '手动标记异常' : undefined,
              updatedAt: new Date().toISOString(),
            };
          });
          const reclassified = classifyAllDeviations(updatedDeviations, state.batches);
          return { deviations: reclassified };
        }),

      classifyDeviations: () =>
        set((state) => ({
          deviations: classifyAllDeviations(state.deviations, state.batches),
        })),

      exportReport: () => {
        const state = get();
        const selectedBatch = state.batches.find((b) => b.id === state.selectedBatchId);
        console.log('Exporting report for batch:', selectedBatch?.title);
      },
    }),
    {
      name: 'pitch-trend-storage',
      partialize: (state) => ({
        batches: state.batches,
        students: state.students,
        deviations: state.deviations,
        notes: state.notes,
      }),
    }
  )
);

export const useSelectedBatch = () => {
  const selectedBatchId = useAppStore((state) => state.selectedBatchId);
  const batches = useAppStore((state) => state.batches);
  return batches.find((b) => b.id === selectedBatchId);
};

export const useSelectedDeviation = () => {
  const selectedDeviationId = useAppStore((state) => state.selectedDeviationId);
  const deviations = useAppStore((state) => state.deviations);
  return deviations.find((d) => d.id === selectedDeviationId);
};

export const useBatchDeviations = (batchId: string | null) => {
  const deviations = useAppStore((state) => state.deviations);
  const filters = useAppStore((state) => state.filters);
  const students = useAppStore((state) => state.students);

  if (!batchId) return [];

  return deviations.filter((d) => {
    if (d.batchId !== batchId) return false;
    
    if (filters.voicePartId) {
      const student = students.find((s) => s.id === d.studentId);
      if (student?.voicePartId !== filters.voicePartId) return false;
    }
    
    if (filters.category && d.category !== filters.category) return false;
    if (filters.showAnomaliesOnly && !d.isAnomaly) return false;
    
    return true;
  });
};

export const useFilters = () => useAppStore((state) => state.filters);
