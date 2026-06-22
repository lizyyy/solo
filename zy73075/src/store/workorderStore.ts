import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Workorder, SparePart, RecallRecord, FullDataset } from '@/types';
import { SAMPLE_DATA } from '@/data/sampleData';
import { mergeImport } from '@/utils/importer';
import { computeHandoverStatus } from '@/utils/handover';

interface WorkorderStore {
  workorders: Workorder[];
  spare_parts: SparePart[];
  recall_records: RecallRecord[];

  loadSampleData: () => void;
  clearAll: () => void;
  replaceAll: (data: FullDataset) => void;

  importDataset: (incoming: FullDataset) => {
    duplicateCount: number;
    preservedNotes: number;
    newRecallCount: number;
  };

  getPartsByWorkorder: (workorderId: string) => SparePart[];
  getRecallsByWorkorder: (workorderId: string) => RecallRecord[];
  refreshHandoverStatus: (workorderId: string) => void;
  refreshAllHandoverStatus: () => void;

  updateWorkorder: (id: string, patch: Partial<Workorder>) => void;
  updateRecall: (id: string, patch: Partial<RecallRecord>) => void;
}

const EMPTY: FullDataset = { workorders: [], spare_parts: [], recall_records: [] };

function _computeStatusForWoId(
  wo: Workorder,
  allParts: SparePart[],
  allRecalls: RecallRecord[],
) {
  const parts = allParts.filter(p => p.workorder_id === wo.id);
  const recalls = allRecalls.filter(r => r.workorder_id === wo.id);
  return computeHandoverStatus(wo, parts, recalls);
}

export const useWorkorderStore = create<WorkorderStore>()(
  persist(
    (set, get) => ({
      ...EMPTY,

      loadSampleData: () => {
        const data = structuredClone(SAMPLE_DATA) as FullDataset;
        const withStatus = data.workorders.map(wo => ({
          ...wo,
          handover_status: _computeStatusForWoId(wo, data.spare_parts, data.recall_records),
        }));
        set({ workorders: withStatus, spare_parts: data.spare_parts, recall_records: data.recall_records });
      },

      clearAll: () => set({ ...EMPTY }),

      replaceAll: (data: FullDataset) => {
        const withStatus = data.workorders.map(wo => ({
          ...wo,
          handover_status: _computeStatusForWoId(wo, data.spare_parts, data.recall_records),
        }));
        set({ workorders: withStatus, spare_parts: data.spare_parts, recall_records: data.recall_records });
      },

      importDataset: (incoming: FullDataset) => {
        const existing = {
          workorders: get().workorders,
          spare_parts: get().spare_parts,
          recall_records: get().recall_records,
        };
        const merged = mergeImport(existing, incoming);
        const withStatus = merged.workorders.map(wo => ({
          ...wo,
          handover_status: _computeStatusForWoId(wo, merged.spare_parts, merged.recall_records),
        }));
        set({
          workorders: withStatus,
          spare_parts: merged.spare_parts,
          recall_records: merged.recall_records,
        });
        return {
          duplicateCount: merged.duplicateCount,
          preservedNotes: merged.preservedNotes,
          newRecallCount: merged.newRecalls.length,
        };
      },

      getPartsByWorkorder: (workorderId: string) =>
        get().spare_parts.filter(p => p.workorder_id === workorder_id),

      getRecallsByWorkorder: (workorderId: string) =>
        get().recall_records.filter(r => r.workorder_id === workorderId),

      refreshHandoverStatus: (workorderId: string) => {
        const { workorders, spare_parts, recall_records } = get();
        const wo = workorders.find(w => w.id === workorderId);
        if (!wo) return;
        const parts = spare_parts.filter(p => p.workorder_id === workorderId);
        const recalls = recall_records.filter(r => r.workorder_id === workorderId);
        const updated = {
          ...wo,
          handover_status: computeHandoverStatus(wo, parts, recalls),
        };
        set({ workorders: workorders.map(w => (w.id === workorderId ? updated : w)) });
      },

      refreshAllHandoverStatus: () => {
        const { workorders, spare_parts, recall_records } = get();
        const updated = workorders.map(wo => ({
          ...wo,
          handover_status: _computeStatusForWoId(wo, spare_parts, recall_records),
        }));
        set({ workorders: updated });
      },

      updateWorkorder: (id: string, patch: Partial<Workorder>) =>
        set(state => ({
          workorders: state.workorders.map(w => (w.id === id ? { ...w, ...patch, updated_at: new Date().toISOString() } : w)),
        })),

      updateRecall: (id: string, patch: Partial<RecallRecord>) =>
        set(state => {
          const target = state.recall_records.find(r => r.id === id);
          const woId = target?.workorder_id;
          const nextRecalls = state.recall_records.map(r => (r.id === id ? { ...r, ...patch } : r));
          if (!woId) return { recall_records: nextRecalls };
          const nextWorkorders = state.workorders.map(w => {
            if (w.id !== woId) return w;
            const partsForWo = state.spare_parts.filter(p => p.workorder_id === woId);
            const recallsForWo = nextRecalls.filter(r => r.workorder_id === woId);
            return {
              ...w,
              handover_status: computeHandoverStatus(w, partsForWo, recallsForWo),
            };
          });
          return { recall_records: nextRecalls, workorders: nextWorkorders };
        })),
    }),
    {
      name: 'shield-cutter-workorder-v1',
    },
  ),
);
