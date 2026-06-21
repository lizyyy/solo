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

type ImportType = 'answer' | 'withdrawn' | 'supplement';

interface AppStore extends AppState {
  selectNode: (nodeId: string | null) => void;
  selectRecord: (recordId: string | null) => void;
  moveRecordTo: (recordId: string, target: 'processed' | 'pending' | 'manual') => void;
  recalcWithdrawn: (recordId: string) => { success: boolean; message: string };
  importWithdrawnRecord: (record: ErrorRecord) => { success: boolean; message: string };
  importRawRecord: (record: ErrorRecord, importType: ImportType) => { success: boolean; message: string };
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

        let reason = dup.reason;
        if (dup.isDuplicate && !reason) {
          const existing = all.find(
            (r) => r.id !== recordId && r.studentId === record.studentId && r.questionId === record.questionId
          );
          reason = `学生 ${record.studentId}（${record.studentName}）+ 题目 ${record.questionId} 组合已有记录${existing ? `（${existing.id}）` : ''}，疑似样本重复，需人工确认是否纳入统计`;
        }

        const updatedRecord: ErrorRecord = {
          ...record,
          status: targetStatus,
          isWithdrawn: false,
          isDuplicate: dup.isDuplicate,
          duplicateReason: reason || '',
          updatedAt: new Date().toISOString(),
        };

        const newRecords = moveRecord(get().records, recordId, targetStatus);

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
            message: `复算完成：检测到重复样本，已归入「人工改判」，原因：${reason}`,
          };
        }
        return { success: true, message: '复算完成：记录已正常归入「已处理」，图表与明细口径校验通过' };
      },

      importWithdrawnRecord: (record) => {
        return get().importRawRecord(record, 'withdrawn');
      },

      importRawRecord: (record, importType) => {
        const targetBucket = importType === 'answer' ? 'processed' : 'pending';
        const isWithdrawn = importType === 'withdrawn';

        const newRecord: ErrorRecord = {
          ...record,
          status: targetBucket,
          isWithdrawn,
          isDuplicate: false,
          duplicateReason: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const records = { ...get().records };
        records[targetBucket] = [...records[targetBucket], newRecord];

        const nodes = calcNodeErrorCounts(get().graph.nodes, records);
        const passed = verifyCaliber(nodes, records);

        set({
          records,
          graph: { ...get().graph, nodes },
          caliberCheckPassed: passed,
        });

        const bucketName = targetBucket === 'processed' ? '已处理' : '待补材料';
        return {
          success: true,
          message: `已导入${importType === 'answer' ? '历史答案' : importType === 'withdrawn' ? '撤回记录' : '补充说明'}，置于「${bucketName}」${isWithdrawn ? '，可点击「撤回复算」处理' : ''}`,
        };
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
