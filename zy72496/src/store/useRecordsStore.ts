import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  CanopyRecord,
  HistoryRecord,
  RecordStatus,
  WorkflowStep,
  OperatorRole,
  ImportResult,
} from '@/types';
import { isSuspectedSameCommunity } from '@/utils/boundaryRules';

interface RecordsState {
  records: CanopyRecord[];
  history: HistoryRecord[];
  currentStep: WorkflowStep;
  selectedRecordId: string | null;
  currentOperator: OperatorRole;
  currentOperatorName: string;

  setCurrentStep: (step: WorkflowStep) => void;
  selectRecord: (id: string | null) => void;
  setOperator: (role: OperatorRole, name: string) => void;

  addRecords: (newRecords: CanopyRecord[]) => ImportResult;
  updateRecordField: (
    recordId: string,
    fieldName: keyof CanopyRecord,
    newValue: string,
    changeReason?: string
  ) => void;
  updateRecordStatus: (
    recordId: string,
    newStatus: RecordStatus,
    changeReason?: string
  ) => void;
  rollbackToHistory: (historyId: string) => void;
  getRecordHistory: (recordId: string) => HistoryRecord[];
  clearAllData: () => void;
  importMockData: () => void;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function addHistoryEntry(
  state: RecordsState,
  recordId: string,
  fieldName: string,
  oldValue: string,
  newValue: string,
  changeReason?: string
): HistoryRecord {
  return {
    id: generateId(),
    recordId,
    fieldName,
    oldValue,
    newValue,
    operator: state.currentOperator,
    operatorName: state.currentOperatorName,
    timestamp: new Date().toISOString(),
    changeReason,
  };
}

function detectDuplicateNames(
  newRecord: CanopyRecord,
  existingRecords: CanopyRecord[]
): { isSuspected: boolean; matchedIds: string[] } {
  const matchedIds: string[] = [];
  for (const record of existingRecords) {
    if (record.id === newRecord.id) continue;
    if (
      record.stationName === newRecord.stationName &&
      isSuspectedSameCommunity(record.communityName, newRecord.communityName)
    ) {
      matchedIds.push(record.id);
    }
  }
  return {
    isSuspected: matchedIds.length > 0,
    matchedIds,
  };
}

export const useRecordsStore = create<RecordsState>()(
  persist(
    (set, get) => ({
      records: [],
      history: [],
      currentStep: WorkflowStep.IMPORT,
      selectedRecordId: null,
      currentOperator: OperatorRole.PLANNER,
      currentOperatorName: '小姜',

      setCurrentStep: (step) => set({ currentStep: step }),
      selectRecord: (id) => set({ selectedRecordId: id }),
      setOperator: (role, name) => set({ currentOperator: role, currentOperatorName: name }),

      addRecords: (newRecords) => {
        const state = get();
        const batchId = generateId();
        const finalRecords: CanopyRecord[] = [];
        let duplicateCount = 0;
        let newCount = 0;

        for (const record of newRecords) {
          const existing = state.records.find(
            (r) =>
              r.communityName === record.communityName &&
              r.stationName === record.stationName &&
              r.originalRowNumber === record.originalRowNumber
          );

          if (existing) {
            duplicateCount++;
            continue;
          }

          const { isSuspected, matchedIds } = detectDuplicateNames(
            { ...record, id: generateId() },
            [...state.records, ...finalRecords]
          );

          const now = new Date().toISOString();
          const newRecord: CanopyRecord = {
            ...record,
            id: generateId(),
            importBatchId: batchId,
            status: isSuspected ? RecordStatus.REVIEWING : RecordStatus.PENDING,
            isSuspectedDuplicateName: isSuspected,
            suspectedMatchedRecordIds: matchedIds,
            createdAt: now,
            updatedAt: now,
          };
          finalRecords.push(newRecord);
          newCount++;
        }

        set({
          records: [...state.records, ...finalRecords],
        });

        return {
          totalCount: newRecords.length,
          newCount,
          duplicateCount,
          skippedCount: newRecords.length - newCount - duplicateCount,
          batchId,
          records: finalRecords,
        };
      },

      updateRecordField: (recordId, fieldName, newValue, changeReason) => {
        const state = get();
        const record = state.records.find((r) => r.id === recordId);
        if (!record) return;

        const oldValue = String(record[fieldName] ?? '');
        if (oldValue === newValue) return;

        const historyEntry = addHistoryEntry(
          state,
          recordId,
          fieldName as string,
          oldValue,
          newValue,
          changeReason
        );

        set({
          records: state.records.map((r) =>
            r.id === recordId
              ? { ...r, [fieldName]: newValue, updatedAt: new Date().toISOString() }
              : r
          ),
          history: [...state.history, historyEntry],
        });
      },

      updateRecordStatus: (recordId, newStatus, changeReason) => {
        const state = get();
        const record = state.records.find((r) => r.id === recordId);
        if (!record || record.status === newStatus) return;

        const historyEntry = addHistoryEntry(
          state,
          recordId,
          'status',
          record.status,
          newStatus,
          changeReason
        );

        set({
          records: state.records.map((r) =>
            r.id === recordId
              ? { ...r, status: newStatus, updatedAt: new Date().toISOString() }
              : r
          ),
          history: [...state.history, historyEntry],
        });
      },

      rollbackToHistory: (historyId) => {
        const state = get();
        const historyEntry = state.history.find((h) => h.id === historyId);
        if (!historyEntry) return;

        const record = state.records.find((r) => r.id === historyEntry.recordId);
        if (!record) return;

        const rollbackHistory = addHistoryEntry(
          state,
          historyEntry.recordId,
          historyEntry.fieldName,
          String((record as any)[historyEntry.fieldName] ?? ''),
          historyEntry.oldValue,
          `回滚到之前版本`
        );

        set({
          records: state.records.map((r) =>
            r.id === historyEntry.recordId
              ? {
                  ...r,
                  [historyEntry.fieldName]: historyEntry.oldValue,
                  updatedAt: new Date().toISOString(),
                }
              : r
          ),
          history: [...state.history, rollbackHistory],
        });
      },

      getRecordHistory: (recordId) => {
        return get()
          .history.filter((h) => h.recordId === recordId)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      },

      clearAllData: () => set({ records: [], history: [], selectedRecordId: null }),

      importMockData: () => {
        const mockRecords: CanopyRecord[] = [
          {
            id: generateId(),
            originalRowNumber: 2,
            communityName: '阳光新村',
            stationName: '人民广场站',
            photoDescription: '站口北侧雨棚，立柱完好',
            busSwipeTime: undefined,
            status: RecordStatus.PENDING,
            isSuspectedDuplicateName: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            importBatchId: 'mock-batch-001',
            importFileName: '2024-06-路口照片第一批.csv',
          },
          {
            id: generateId(),
            originalRowNumber: 3,
            communityName: '阳光小区',
            stationName: '人民广场站',
            photoDescription: '站口南侧雨棚，有轻微漏雨',
            busSwipeTime: undefined,
            status: RecordStatus.REVIEWING,
            isSuspectedDuplicateName: true,
            suspectedMatchedRecordIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            importBatchId: 'mock-batch-001',
            importFileName: '2024-06-路口照片第一批.csv',
          },
          {
            id: generateId(),
            originalRowNumber: 5,
            communityName: '东方明珠花园',
            stationName: '陆家嘴站',
            photoDescription: '1号口雨棚，玻璃完好',
            busSwipeTime: '早高峰 7:30-9:00',
            status: RecordStatus.PLANNER_DONE,
            isSuspectedDuplicateName: false,
            plannerRemark: '公交刷卡数据显示早高峰人流量大，雨棚完好无需维修',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            importBatchId: 'mock-batch-001',
            importFileName: '2024-06-路口照片第一批.csv',
          },
          {
            id: generateId(),
            originalRowNumber: 7,
            communityName: '和平里东区',
            stationName: '静安寺站',
            photoDescription: '3号口雨棚支架有锈迹',
            busSwipeTime: undefined,
            status: RecordStatus.REVIEWING,
            isSuspectedDuplicateName: true,
            suspectedMatchedRecordIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            importBatchId: 'mock-batch-002',
            importFileName: '2024-06-路口照片第二批.csv',
          },
          {
            id: generateId(),
            originalRowNumber: 8,
            communityName: '和平里西区',
            stationName: '静安寺站',
            photoDescription: '4号口雨棚排水槽堵塞',
            busSwipeTime: '全天均匀',
            status: RecordStatus.PROBLEM,
            isSuspectedDuplicateName: true,
            suspectedMatchedRecordIds: [],
            plannerRemark: '疑似与和平里东区为同一小区不同区，雨棚问题需重点关注',
            inspectorRemark: '已核实为同一小区东西两区，均需维修',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            importBatchId: 'mock-batch-002',
            importFileName: '2024-06-路口照片第二批.csv',
          },
          {
            id: generateId(),
            originalRowNumber: 12,
            communityName: '锦绣家园',
            stationName: '徐家汇站',
            photoDescription: '2号口雨棚完好',
            busSwipeTime: '晚高峰 17:30-19:00',
            status: RecordStatus.NORMAL,
            isSuspectedDuplicateName: false,
            plannerRemark: '正常，无需处理',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            importBatchId: 'mock-batch-002',
            importFileName: '2024-06-路口照片第二批.csv',
          },
        ];

        const recordsWithMatches = mockRecords.map((record, idx) => {
          const matches: string[] = [];
          for (let i = 0; i < mockRecords.length; i++) {
            if (i === idx) continue;
            const other = mockRecords[i];
            if (
              other.stationName === record.stationName &&
              isSuspectedSameCommunity(other.communityName, record.communityName)
            ) {
              matches.push(other.id);
            }
          }
          return {
            ...record,
            suspectedMatchedRecordIds: matches,
            isSuspectedDuplicateName: matches.length > 0,
            status: matches.length > 0 && record.status === RecordStatus.PENDING
              ? RecordStatus.REVIEWING
              : record.status,
          };
        });

        set({ records: recordsWithMatches, history: [] });
      },
    }),
    {
      name: 'canopy-inspection-storage',
    }
  )
);
