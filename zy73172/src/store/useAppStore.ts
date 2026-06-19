import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, ErrorRecord, RecordState } from '@/types';
import { seedGraph, seedRecords } from '@/data/seedData';
import {
  checkDuplicate,
  getAllRecords,
  calcNodeErrorCounts,
  verifyCaliber,
  moveRecord,
} from '@/utils/records';

interface AppStore extends AppState {
  selectNode: (nodeId: string | null) => void;
  selectRecord: (recordId: string | null) => void;
  moveRecordTo: (recordId: string, target: 'processed' | 'pending' | 'manual') => void;
  recalcWithdrawn: (recordId: string) => { success: boolean; message: string };
  importWithdrawnRecord: (record: ErrorRecord) => { success: boolean; message: string };
  resetToSeed: () => void;
  updateRecordNote: (recordId: string, note: string) => void;
}

const initialState: AppState = {
  graph: {
    nodes: calcNodeErrorCounts(seedGraph.nodes, seedRecords),
    edges: seedGraph.edges,
  },
  records: seedRecords,
  selectedNodeId: null,
  selectedRecordId: null,
  lastRecalcTime: null,
  caliberCheckPassed: true,
};

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      selectNode: (nodeId) => set({ selectedNodeId: nodeId, selectedRecordId: null }),

      selectRecord: (recordId) => {
        set({ selectedRecordId: recordId });
        const all = getAllRecords(get().records);
        const record = all.find((r) => r.id === recordId);
        if (record) {
          set({ selectedNodeId: record.nodeId });
        }
      },

      moveRecordTo: (recordId, target) => {
        const records = moveRecord(get().records, recordId, target);
        const nodes = calcNodeErrorCounts(get().graph.nodes, records);
        const passed = verifyCaliber(nodes, records);
        set({
          records,
          graph: { ...get().graph, nodes },
          caliberCheckPassed: passed,
        });
      },

      recalcWithdrawn: (recordId) => {
        const all = getAllRecords(get().records);
        const record = all.find((r) => r.id === recordId);
        if (!record) {
          return { success: false, message: '记录不存在' };
        }

        const dup = checkDuplicate(record, all, recordId);
        const targetStatus = dup.isDuplicate ? 'manual' : 'processed';
        const updatedRecord: ErrorRecord = {
          ...record,
          status: targetStatus,
          isWithdrawn: false,
          isDuplicate: dup.isDuplicate,
          duplicateReason: dup.reason,
          updatedAt: new Date().toISOString(),
        };

        const newRecords = moveRecord(get().records, recordId, targetStatus);

        const allNew = getAllRecords(newRecords);
        const idx = allNew.findIndex((r) => r.id === recordId);
        const targetList = newRecords[targetStatus];
        const targetIdx = targetList.findIndex((r) => r.id === recordId);
        if (targetIdx >= 0) {
          (newRecords[targetStatus] as ErrorRecord[])[targetIdx] = updatedRecord;
        }

        const nodes = calcNodeErrorCounts(get().graph.nodes, newRecords);
        const passed = verifyCaliber(nodes, newRecords);

        set({
          records: newRecords,
          graph: { ...get().graph, nodes },
          lastRecalcTime: new Date().toISOString(),
          caliberCheckPassed: passed,
        });

        if (dup.isDuplicate) {
          return {
            success: true,
            message: `复算完成：检测到重复样本，已归入「人工改判」，原因：${dup.reason}`,
          };
        }
        return { success: true, message: '复算完成：记录已正常归入「已处理」，图表与明细口径校验通过' };
      },

      importWithdrawnRecord: (record) => {
        const all = getAllRecords(get().records);
        const dup = checkDuplicate(record, all);
        const newRecord: ErrorRecord = {
          ...record,
          isWithdrawn: true,
          isDuplicate: dup.isDuplicate,
          duplicateReason: dup.reason,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const records = { ...get().records };
        records.pending = [...records.pending, newRecord];

        const nodes = calcNodeErrorCounts(get().graph.nodes, records);
        const passed = verifyCaliber(nodes, records);

        set({
          records,
          graph: { ...get().graph, nodes },
          caliberCheckPassed: passed,
        });

        return { success: true, message: '撤回记录已导入，置于「待补材料」桶，可点击「复算」处理' };
      },

      resetToSeed: () => {
        const nodes = calcNodeErrorCounts(seedGraph.nodes, seedRecords);
        set({
          ...initialState,
          graph: { nodes, edges: seedGraph.edges },
        });
      },

      updateRecordNote: (recordId, note) => {
        set((state) => {
          const records = { ...state.records } as RecordState;
          for (const key of ['processed', 'pending', 'manual'] as const) {
            const idx = records[key].findIndex((r) => r.id === recordId);
            if (idx >= 0) {
              records[key] = [...records[key]];
              records[key][idx] = {
                ...records[key][idx],
                note,
                updatedAt: new Date().toISOString(),
              };
              break;
            }
          }
          return { records };
        });
      },
    }),
    {
      name: 'graph-error-attribution:v1',
      version: 1,
    }
  )
);
