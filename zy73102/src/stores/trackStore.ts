import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  TrackStoreState,
  TrackBatch,
  TrackRun,
  ExportRecord,
  FilterState,
} from '@/types';
import {
  mockBatch,
  mockRuns,
  mockMaterials,
  mockCollisions,
  mockMeetingNotes,
} from '@/data/mock/samplePackA';

const initialFilterState: FilterState = {
  materialTypes: [],
  processingStatuses: [],
  drawingVersions: [],
  collisionOnly: false,
};

export const useTrackStore = create<TrackStoreState>()(
  persist(
    (set, get) => ({
      batches: [],
      runs: [],
      materials: [],
      collisions: [],
      meetingNotes: [],
      exportRecords: [],
      currentBatchId: null,
      currentRunId: null,
      filterState: initialFilterState,

      addBatch: (batch: TrackBatch) =>
        set((state) => ({
          batches: [...state.batches, batch],
          currentBatchId: batch.batchId,
        })),

      addRun: (run: TrackRun) =>
        set((state) => ({
          runs: [...state.runs, run],
          currentRunId: run.runId,
        })),

      setCurrentBatch: (batchId) => set({ currentBatchId: batchId }),
      setCurrentRun: (runId) => set({ currentRunId: runId }),

      getRunsByBatchId: (batchId) =>
        get()
          .runs.filter((r) => r.batchId === batchId)
          .sort((a, b) => a.runNumber - b.runNumber),

      getMaxRunNumber: (batchId) => {
        const runs = get().runs.filter((r) => r.batchId === batchId);
        return runs.length === 0 ? 0 : Math.max(...runs.map((r) => r.runNumber));
      },

      addExportRecord: (record: ExportRecord) =>
        set((state) => ({
          exportRecords: [record, ...state.exportRecords],
        })),

      loadSamplePack: () =>
        set({
          batches: [mockBatch],
          runs: mockRuns,
          materials: mockMaterials,
          collisions: mockCollisions,
          meetingNotes: mockMeetingNotes,
          currentBatchId: mockBatch.batchId,
          currentRunId: mockBatch.currentRunId ?? null,
        }),

      updateFilter: (filter) =>
        set((state) => ({
          filterState: { ...state.filterState, ...filter },
        })),
    }),
    {
      name: 'track-store',
    }
  )
);
