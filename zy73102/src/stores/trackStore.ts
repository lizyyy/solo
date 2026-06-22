import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  TrackStoreState,
  TrackBatch,
  TrackRun,
  ExportRecord,
  FilterState,
  MaterialItem,
  CollisionPoint,
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

      rerunRun: (sourceRunId: string, remark: string) => {
        const state = get();
        const sourceRun = state.runs.find((r) => r.runId === sourceRunId);
        if (!sourceRun) return null;

        const sourceMaterials = state.materials.filter((m) => m.runId === sourceRunId);
        const sourceCollisions = state.collisions.filter((c) => c.runId === sourceRunId);

        const maxNum = state.getMaxRunNumber(sourceRun.batchId);
        const newRunId = `RUN-${Date.now()}`;
        const newDrawingVersion = sourceRun.drawingVersion.replace(
          /V(\d+)\.(\d+)/,
          (_m, a, b) => `V${a}.${Number(b) + 1}`
        );

        const materialIdMap: Record<string, string> = {};
        const newMaterials: MaterialItem[] = sourceMaterials.map((m, i) => {
          const newMaterialId = `MAT-${newRunId}-${String(i + 1).padStart(3, '0')}`;
          materialIdMap[m.materialId] = newMaterialId;
          return {
            ...m,
            materialId: newMaterialId,
            runId: newRunId,
            drawingVersion: newDrawingVersion,
            threeMeshId: `mesh_${newRunId}_${i}`,
          };
        });

        const newCollisions: CollisionPoint[] = sourceCollisions.map((c, i) => ({
          ...c,
          collisionId: `COL-${newRunId}-${String(i + 1).padStart(3, '0')}`,
          runId: newRunId,
          involvedMaterialIds: c.involvedMaterialIds.map((id) => materialIdMap[id] || id),
        }));

        const collisionInvolvedIds = new Set(
          newCollisions.flatMap((c) => c.involvedMaterialIds)
        );
        const finalMaterials = newMaterials.map((m) => ({
          ...m,
          involvedInCollision: collisionInvolvedIds.has(m.materialId),
        }));

        const newRun: TrackRun = {
          runId: newRunId,
          batchId: sourceRun.batchId,
          runNumber: maxNum + 1,
          remark,
          executedAt: new Date().toISOString(),
          resultStatus: 'success',
          drawingVersion: newDrawingVersion,
          materialCount: finalMaterials.length,
          collisionCount: newCollisions.length,
          abnormalCount: finalMaterials.filter((m) => m.processingStatus === 'conflicted' || m.processingStatus === 'pending').length,
          materials: finalMaterials,
          collisions: newCollisions,
        };

        set({
          runs: [...state.runs, newRun],
          materials: [...state.materials, ...finalMaterials],
          collisions: [...state.collisions, ...newCollisions],
          currentRunId: newRunId,
        });

        return newRun;
      },

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
