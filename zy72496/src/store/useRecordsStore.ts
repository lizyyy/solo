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

export interface EnhancedImportResult extends ImportResult {
  reusedCount: number;
  overwrittenCount: number;
  reusedRecordIds: string[];
  overwrittenRecordIds: string[];
}

export interface DuplicateImportOption {
  mode: 'skip' | 'overwrite_keep_history' | 'overwrite_all';
}

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

  addRecords: (
    newRecords: CanopyRecord[],
    importOptions?: DuplicateImportOption
  ) => EnhancedImportResult;

  findDuplicateRecords: (
    communityName: string,
    stationName: string,
    originalRowNumber: number
  ) => CanopyRecord | undefined;

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

  rollbackToHistory: (historyId: string, reason?: string) => void;

  getRecordHistory: (recordId: string) => HistoryRecord[];

  getFieldHistory: (recordId: string, fieldName: string) => HistoryRecord[];

  getHistoryById: (historyId: string) => HistoryRecord | undefined;

  getRollbackChain: (historyId: string) => HistoryRecord[];

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
  changeReason?: string,
  extraMeta?: Partial<HistoryRecord>
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
    ...extraMeta,
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

const FIELDS_NOT_TO_OVERWRITE = ['plannerRemark', 'inspectorRemark', 'status', 'busSwipeTime'];

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

      findDuplicateRecords: (communityName, stationName, originalRowNumber) => {
        return get().records.find(
          (r) =>
            r.communityName === communityName &&
            r.stationName === stationName &&
            r.originalRowNumber === originalRowNumber
        );
      },

      addRecords: (newRecords, importOptions = { mode: 'skip' }) => {
        const state = get();
        const batchId = generateId();
        const newAddedRecords: CanopyRecord[] = [];
        const reusedRecordIds: string[] = [];
        const overwrittenRecordIds: string[] = [];
        let duplicateCount = 0;
        let newCount = 0;
        let overwrittenCount = 0;
        const newHistoryEntries: HistoryRecord[] = [];
        const updatedRecords: CanopyRecord[] = [...state.records];

        for (const record of newRecords) {
          const existingIdx = updatedRecords.findIndex(
            (r) =>
              r.communityName === record.communityName &&
              r.stationName === record.stationName &&
              r.originalRowNumber === record.originalRowNumber
          );

          if (existingIdx >= 0) {
            duplicateCount++;
            const existing = updatedRecords[existingIdx];
            reusedRecordIds.push(existing.id);

            if (importOptions.mode === 'overwrite_keep_history' || importOptions.mode === 'overwrite_all') {
              const now = new Date().toISOString();
              const updated = { ...existing, updatedAt: now };

              const fieldsToCompare: (keyof CanopyRecord)[] = ['photoDescription', 'photoUrl'];
              if (importOptions.mode === 'overwrite_all') {
                fieldsToCompare.push('busSwipeTime');
              }

              for (const field of fieldsToCompare) {
                const oldVal = String((existing as any)[field] ?? '');
                const newVal = String((record as any)[field] ?? '');
                if (oldVal !== newVal && newVal !== '') {
                  newHistoryEntries.push(
                    addHistoryEntry(
                      state,
                      existing.id,
                      field as string,
                      oldVal,
                      newVal,
                      `重复导入覆盖${importOptions.mode === 'overwrite_all' ? '(全部模式)' : '(保留备注/状态模式)'}`
                    )
                  );
                  (updated as any)[field] = newVal;
                }
              }

              updatedRecords[existingIdx] = updated;
              overwrittenRecordIds.push(existing.id);
              overwrittenCount++;
            }
            continue;
          }

          const { isSuspected, matchedIds } = detectDuplicateNames(
            { ...record, id: generateId() },
            [...updatedRecords, ...newAddedRecords]
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
          newAddedRecords.push(newRecord);
          newCount++;
        }

        const finalRecords = [...updatedRecords, ...newAddedRecords];

        for (const newRec of newAddedRecords) {
          if (newRec.isSuspectedDuplicateName && newRec.suspectedMatchedRecordIds) {
            for (const matchId of newRec.suspectedMatchedRecordIds) {
              const idx = finalRecords.findIndex((r) => r.id === matchId);
              if (idx >= 0) {
                const matched = finalRecords[idx];
                const newMatchIds = new Set([
                  ...(matched.suspectedMatchedRecordIds || []),
                  newRec.id,
                ]);
                finalRecords[idx] = {
                  ...matched,
                  suspectedMatchedRecordIds: Array.from(newMatchIds),
                  isSuspectedDuplicateName: true,
                  status: matched.status === RecordStatus.PENDING ? RecordStatus.REVIEWING : matched.status,
                  updatedAt: new Date().toISOString(),
                };
              }
            }
          }
        }

        set({
          records: finalRecords,
          history: [...state.history, ...newHistoryEntries],
        });

        return {
          totalCount: newRecords.length,
          newCount,
          duplicateCount,
          reusedCount: reusedRecordIds.length,
          overwrittenCount,
          reusedRecordIds,
          overwrittenRecordIds,
          skippedCount: newRecords.length - newCount - overwrittenCount,
          batchId,
          records: newAddedRecords,
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

      rollbackToHistory: (historyId, reason) => {
        const state = get();
        const historyEntry = state.history.find((h) => h.id === historyId);
        if (!historyEntry) return;

        const record = state.records.find((r) => r.id === historyEntry.recordId);
        if (!record) return;

        const currentValue = String((record as any)[historyEntry.fieldName] ?? '');
        const targetValue = historyEntry.oldValue;

        const rollbackMeta: Partial<HistoryRecord> = {
          id: generateId(),
          timestamp: new Date().toISOString(),
        };

        const rollbackHistory = addHistoryEntry(
          state,
          historyEntry.recordId,
          historyEntry.fieldName,
          currentValue,
          targetValue,
          reason || `回滚至 [${new Date(historyEntry.timestamp).toLocaleString('zh-CN')}] 的版本：从 "${historyEntry.newValue}" 还原为 "${historyEntry.oldValue}"`,
          rollbackMeta
        );

        set({
          records: state.records.map((r) =>
            r.id === historyEntry.recordId
              ? {
                  ...r,
                  [historyEntry.fieldName]: targetValue,
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

      getFieldHistory: (recordId, fieldName) => {
        return get()
          .history.filter((h) => h.recordId === recordId && h.fieldName === fieldName)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      },

      getHistoryById: (historyId) => {
        return get().history.find((h) => h.id === historyId);
      },

      getRollbackChain: (historyId) => {
        const history = get().history;
        const chain: HistoryRecord[] = [];
        let current = history.find((h) => h.id === historyId);
        if (!current) return chain;
        chain.push(current);

        for (let limit = 0; limit < 50; limit++) {
          const target = current.oldValue;
          const field = current.fieldName;
          const prev = history
            .filter(
              (h) =>
                h.recordId === current!.recordId &&
                h.fieldName === field &&
                h.newValue === target &&
                new Date(h.timestamp).getTime() < new Date(current!.timestamp).getTime()
            )
            .sort(
              (a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )[0];
          if (!prev) break;
          chain.unshift(prev);
          current = prev;
        }
        return chain;
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
