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

  updateWorkorder: (id: string, patch: Partial<Workorder>) => void;
  updateRecall: (id: string, patch: Partial<RecallRecord>) => void;
}

const EMPTY: FullDataset = { workorders: [], spare_parts: [], recall_records: [] };

export const useWorkorderStore = create<WorkorderStore>()(
  persist(
    (set, get) => ({
      ...EMPTY,

      loadSampleData: () => {
        const data = structuredClone(SAMPLE_DATA) as FullDataset;
        const withStatus = data.workorders.map(wo => ({
          ...wo,
          handover_status: computeHandoverStatus(
            wo,
            data.spare_parts.filter(p => p.workorder_id === wo.id),
          ),
        }));
        set({ workorders: withStatus, spare_parts: data.spare_parts, recall_records: data.recall_records });
      },

      clearAll: () => set({ ...EMPTY }),

      replaceAll: (data: FullDataset) => {
        const withStatus = data.workorders.map(wo => ({
          ...wo,
          handover_status: computeHandoverStatus(
            wo,
            data.spare_parts.filter(p => p.workorder_id === wo.id),
          ),
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
          handover_status: computeHandoverStatus(
            wo,
            merged.spare_parts.filter(p => p.workorder_id === wo.id),
          ),
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
        get().spare_parts.filter(p => p.workorder_id === workorderId),

      getRecallsByWorkorder: (workorderId: string) =>
        get().recall_records.filter(r => r.workorder_id === workorderId),

      refreshHandoverStatus: (workorderId: string) => {
        const { workorders, spare_parts } = get();
        const wo = workorders.find(w => w.id === workorderId);
        if (!wo) return;
        const parts = spare_parts.filter(p => p.workorder_id === workorderId);
        const updated = { ...wo, handover_status: computeHandoverStatus(wo, parts) };
        set({ workorders: workorders.map(w => (w.id === workorderId ? updated : w)) });
      },

      updateWorkorder: (id: string, patch: Partial<Workorder>) =>
        set(state => ({
          workorders: state.workorders.map(w => (w.id === id ? { ...w, ...patch, updated_at: new Date().toISOString() } : w)),
        })),

      updateRecall: (id: string, patch: Partial<RecallRecord>) =>
        set(state => ({
          recall_records: state.recall_records.map(r => (r.id === id ? { ...r, ...patch } : r)),
        })),
    }),
    {
      name: 'shield-cutter-workorder-v1',
    },
  ),
);
