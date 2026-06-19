import { create } from 'zustand';
import {
  ContractScreenshot,
  TrackAlias,
  RehearsalRecord,
  ChangeHistory,
  ReviewTask,
  BoundaryRules,
  User,
  RecordStatus,
  EntityType,
} from '../types';
import {
  mockContracts,
  mockTrackAliases,
  mockRecords,
  mockHistory,
  mockReviewTasks,
  defaultBoundaryRules,
  mockUsers,
} from '../data/mockData';
import { detectReworkReason } from '../utils/reworkDetector';
import { recordChange, getFieldNameText } from '../utils/historyTracker';
import { generateId } from '../utils/boundaryRules';

interface AppState {
  currentUser: User;
  contracts: ContractScreenshot[];
  trackAliases: TrackAlias[];
  records: RehearsalRecord[];
  history: ChangeHistory[];
  reviewTasks: ReviewTask[];
  boundaryRules: BoundaryRules;
  selectedRecordId: string | null;
  selectedContractId: string | null;
  selectedTrackId: string | null;

  setCurrentUser: (user: User) => void;
  addContract: (contract: ContractScreenshot) => void;
  updateContract: (id: string, updates: Partial<ContractScreenshot>, changedBy: string) => void;
  addTrackAlias: (alias: TrackAlias) => void;
  updateTrackAlias: (id: string, updates: Partial<TrackAlias>, changedBy: string) => void;
  addRecord: (record: RehearsalRecord) => void;
  updateRecord: (id: string, updates: Partial<RehearsalRecord>, changedBy: string) => void;
  addHistory: (history: ChangeHistory) => void;
  updateReviewTask: (id: string, updates: Partial<ReviewTask>, changedBy: string) => void;
  processRecordWithReworkCheck: (recordId: string) => void;
  rollbackHistory: (historyId: string, rolledBy: string) => boolean;
  setSelectedRecordId: (id: string | null) => void;
  setSelectedContractId: (id: string | null) => void;
  setSelectedTrackId: (id: string | null) => void;
  getTrackById: (id: string) => TrackAlias | undefined;
  getContractById: (id: string) => ContractScreenshot | undefined;
  getRecordById: (id: string) => RehearsalRecord | undefined;
  getReviewTaskByRecordId: (recordId: string) => ReviewTask | undefined;
  getHistoryByRecordId: (recordId: string) => ChangeHistory[];
  getHistoryByEntityType: (entityType: EntityType) => ChangeHistory[];
  getPendingReviewCount: () => number;
  getLateCount: () => number;
  getTotalRecords: () => number;
}

export const useStore = create<AppState>((set, get) => ({
  currentUser: mockUsers[0],
  contracts: mockContracts,
  trackAliases: mockTrackAliases,
  records: mockRecords,
  history: mockHistory,
  reviewTasks: mockReviewTasks,
  boundaryRules: defaultBoundaryRules,
  selectedRecordId: null,
  selectedContractId: null,
  selectedTrackId: null,

  setCurrentUser: (user) => set({ currentUser: user }),

  addContract: (contract) =>
    set((state) => ({
      contracts: [...state.contracts, contract],
    })),

  updateContract: (id, updates, changedBy) =>
    set((state) => {
      const oldContract = state.contracts.find((c) => c.id === id);
      if (!oldContract) return state;

      const newContract = { ...oldContract, ...updates };
      const newHistory: ChangeHistory[] = [];

      for (const key of Object.keys(updates) as (keyof ContractScreenshot)[]) {
        const change = recordChange(
          'contract',
          id,
          oldContract,
          newContract,
          key,
          changedBy,
          'update'
        );
        if (change) {
          newHistory.push(change);
        }
      }

      return {
        contracts: state.contracts.map((c) =>
          c.id === id ? newContract : c
        ),
        history: [...state.history, ...newHistory],
      };
    }),

  addTrackAlias: (alias) =>
    set((state) => ({
      trackAliases: [...state.trackAliases, alias],
    })),

  updateTrackAlias: (id, updates, changedBy) =>
    set((state) => {
      const oldAlias = state.trackAliases.find((a) => a.id === id);
      if (!oldAlias) return state;

      const newAlias = { ...oldAlias, ...updates, updatedAt: new Date(), updatedBy: changedBy };

      const newHistory: ChangeHistory[] = [];
      for (const key of Object.keys(updates) as (keyof TrackAlias)[]) {
        if (key === 'updatedAt' || key === 'updatedBy') continue;
        const change = recordChange(
          'track_alias',
          id,
          oldAlias,
          newAlias,
          key,
          changedBy,
          'update'
        );
        if (change) {
          newHistory.push(change);
        }
      }

      return {
        trackAliases: state.trackAliases.map((a) =>
          a.id === id ? newAlias : a
        ),
        history: [...state.history, ...newHistory],
      };
    }),

  addRecord: (record) =>
    set((state) => ({
      records: [...state.records, record],
    })),

  updateRecord: (id, updates, changedBy) =>
    set((state) => {
      const oldRecord = state.records.find((r) => r.id === id);
      if (!oldRecord) return state;

      const newRecord = { ...oldRecord, ...updates, updatedAt: new Date() };

      const newHistory: ChangeHistory[] = [];
      for (const key of Object.keys(updates) as (keyof RehearsalRecord)[]) {
        if (key === 'updatedAt') continue;
        const change = recordChange(
          'rehearsal_record',
          id,
          oldRecord,
          newRecord,
          key,
          changedBy,
          'update'
        );
        if (change) {
          newHistory.push(change);
        }
      }

      return {
        records: state.records.map((r) =>
          r.id === id ? newRecord : r
        ),
        history: [...state.history, ...newHistory],
      };
    }),

  addHistory: (historyItem) =>
    set((state) => ({
      history: [...state.history, historyItem],
    })),

  updateReviewTask: (id, updates, changedBy) =>
    set((state) => {
      const oldTask = state.reviewTasks.find((t) => t.id === id);
      if (!oldTask) return state;

      const newTask = { ...oldTask, ...updates };
      const newHistory: ChangeHistory[] = [];

      for (const key of Object.keys(updates) as (keyof ReviewTask)[]) {
        const change = recordChange(
          'review_task',
          id,
          oldTask,
          newTask,
          key,
          changedBy,
          'update'
        );
        if (change) {
          newHistory.push(change);
        }
      }

      return {
        reviewTasks: state.reviewTasks.map((t) =>
          t.id === id ? newTask : t
        ),
        history: [...state.history, ...newHistory],
      };
    }),

  processRecordWithReworkCheck: (recordId) =>
    set((state) => {
      const record = state.records.find((r) => r.id === recordId);
      if (!record) return state;

      const result = detectReworkReason(record.trackRemark, state.boundaryRules.reworkDetection);

      let newStatus: RecordStatus = 'normal';
      let hasRework = false;
      let newReviewTask: ReviewTask | null = null;

      if (result.hasRework) {
        newStatus = 'pending_review';
        hasRework = true;
        newReviewTask = {
          id: generateId('review'),
          recordId,
          reworkReason: result.matchedKeywords.map(k => `检测到关键词: ${k}`).join('; '),
          reviewStatus: 'pending',
          reviewComment: '',
          reviewedBy: '',
          reviewedAt: null,
        };
      }

      const updatedRecord = {
        ...record,
        hasReworkReason: hasRework,
        status: newStatus,
        updatedAt: new Date(),
      };

      const newHistory: ChangeHistory[] = [];

      const statusChange = recordChange(
        'rehearsal_record',
        recordId,
        record,
        updatedRecord,
        'status',
        '系统',
        'update'
      );
      if (statusChange) newHistory.push(statusChange);

      const reworkChange = recordChange(
        'rehearsal_record',
        recordId,
        record,
        updatedRecord,
        'hasReworkReason',
        '系统',
        'update'
      );
      if (reworkChange) newHistory.push(reworkChange);

      return {
        records: state.records.map((r) =>
          r.id === recordId ? updatedRecord : r
        ),
        reviewTasks: newReviewTask
          ? [...state.reviewTasks, newReviewTask]
          : state.reviewTasks,
        history: [...state.history, ...newHistory],
      };
    }),

  rollbackHistory: (historyId, rolledBy) => {
    const state = get();
    const historyItem = state.history.find((h) => h.id === historyId);
    if (!historyItem) return false;

    const rollbackHistoryRecord: ChangeHistory = {
      id: generateId('history'),
      entityType: historyItem.entityType,
      recordId: historyItem.recordId,
      fieldName: historyItem.fieldName,
      oldValue: historyItem.newValue,
      newValue: historyItem.oldValue,
      changedBy: rolledBy,
      changedAt: new Date(),
      changeType: 'rollback',
    };

    if (historyItem.entityType === 'track_alias') {
      const alias = state.trackAliases.find((a) => a.id === historyItem.recordId);
      if (!alias) return false;

      const fieldKey = historyItem.fieldName as keyof TrackAlias;
      const oldValue = alias[fieldKey];
      const rolledBackAlias = {
        ...alias,
        [fieldKey]: historyItem.oldValue,
        updatedAt: new Date(),
        updatedBy: rolledBy,
      };

      const relatedRecords = state.records.filter((r) => r.trackId === alias.id);
      const updatedRecords = [...state.records];
      const additionalHistory: ChangeHistory[] = [];
      const updatedReviewTasks = [...state.reviewTasks];

      if (historyItem.fieldName === 'remark') {
        for (const record of relatedRecords) {
          const oldHasRework = record.hasReworkReason;
          const oldStatus = record.status;

          const result = detectReworkReason(historyItem.oldValue, state.boundaryRules.reworkDetection);
          const newHasRework = result.hasRework;
          const newStatus: RecordStatus = result.hasRework ? 'pending_review' : 'normal';

          if (oldHasRework !== newHasRework || oldStatus !== newStatus) {
            const recordIndex = updatedRecords.findIndex((r) => r.id === record.id);
            if (recordIndex !== -1) {
              const updatedRecord = {
                ...updatedRecords[recordIndex],
                hasReworkReason: newHasRework,
                status: newStatus,
                updatedAt: new Date(),
              };
              updatedRecords[recordIndex] = updatedRecord;

              const statusChange = recordChange(
                'rehearsal_record',
                record.id,
                record,
                updatedRecord,
                'status',
                '系统(回滚联动)',
                'update'
              );
              if (statusChange) additionalHistory.push(statusChange);

              const reworkChange = recordChange(
                'rehearsal_record',
                record.id,
                record,
                updatedRecord,
                'hasReworkReason',
                '系统(回滚联动)',
                'update'
              );
              if (reworkChange) additionalHistory.push(reworkChange);

              if (newHasRework) {
                const existingTask = updatedReviewTasks.find((t) => t.recordId === record.id);
                if (!existingTask) {
                  updatedReviewTasks.push({
                    id: generateId('review'),
                    recordId: record.id,
                    reworkReason: result.matchedKeywords.map(k => `检测到关键词: ${k}`).join('; '),
                    reviewStatus: 'pending',
                    reviewComment: '',
                    reviewedBy: '',
                    reviewedAt: null,
                  });
                }
              }
            }
          }
        }
      }

      set({
        trackAliases: state.trackAliases.map((a) =>
          a.id === alias.id ? rolledBackAlias : a
        ),
        records: updatedRecords,
        reviewTasks: updatedReviewTasks,
        history: [...state.history, rollbackHistoryRecord, ...additionalHistory],
      });
      return true;
    }

    if (historyItem.entityType === 'rehearsal_record') {
      const record = state.records.find((r) => r.id === historyItem.recordId);
      if (!record) return false;

      const fieldKey = historyItem.fieldName as keyof RehearsalRecord;
      const rolledBackRecord = {
        ...record,
        [fieldKey]: historyItem.oldValue,
        updatedAt: new Date(),
      };

      const additionalHistory: ChangeHistory[] = [];
      let updatedReviewTasks = [...state.reviewTasks];

      if (historyItem.fieldName === 'trackRemark') {
        const result = detectReworkReason(historyItem.oldValue, state.boundaryRules.reworkDetection);
        const newHasRework = result.hasRework;
        const newStatus: RecordStatus = result.hasRework ? 'pending_review' : 'normal';

        rolledBackRecord.hasReworkReason = newHasRework;
        rolledBackRecord.status = newStatus;

        const statusChange = recordChange(
          'rehearsal_record',
          record.id,
          record,
          rolledBackRecord,
          'status',
          '系统(回滚联动)',
          'update'
        );
        if (statusChange) additionalHistory.push(statusChange);

        const reworkChange = recordChange(
          'rehearsal_record',
          record.id,
          record,
          rolledBackRecord,
          'hasReworkReason',
          '系统(回滚联动)',
          'update'
        );
        if (reworkChange) additionalHistory.push(reworkChange);

        if (newHasRework) {
          const existingTask = updatedReviewTasks.find((t) => t.recordId === record.id);
          if (!existingTask) {
            updatedReviewTasks.push({
              id: generateId('review'),
              recordId: record.id,
              reworkReason: result.matchedKeywords.map(k => `检测到关键词: ${k}`).join('; '),
              reviewStatus: 'pending',
              reviewComment: '',
              reviewedBy: '',
              reviewedAt: null,
            });
          }
        }
      }

      set({
        records: state.records.map((r) =>
          r.id === record.id ? rolledBackRecord : r
        ),
        reviewTasks: updatedReviewTasks,
        history: [...state.history, rollbackHistoryRecord, ...additionalHistory],
      });
      return true;
    }

    if (historyItem.entityType === 'contract') {
      const contract = state.contracts.find((c) => c.id === historyItem.recordId);
      if (!contract) return false;

      const fieldKey = historyItem.fieldName as keyof ContractScreenshot;
      let typedOldValue: any = historyItem.oldValue;

      if (fieldKey === 'importCount' || fieldKey === 'fileSize') {
        typedOldValue = Number(historyItem.oldValue) || 0;
      }
      if (fieldKey === 'lastImportTime' || fieldKey === 'uploadTime') {
        typedOldValue = new Date(historyItem.oldValue);
      }

      const rolledBackContract = {
        ...contract,
        [fieldKey]: typedOldValue,
      };

      set({
        contracts: state.contracts.map((c) =>
          c.id === contract.id ? rolledBackContract : c
        ),
        history: [...state.history, rollbackHistoryRecord],
      });
      return true;
    }

    return false;
  },

  setSelectedRecordId: (id) => set({ selectedRecordId: id }),
  setSelectedContractId: (id) => set({ selectedContractId: id }),
  setSelectedTrackId: (id) => set({ selectedTrackId: id }),

  getTrackById: (id) => get().trackAliases.find((a) => a.id === id),
  getContractById: (id) => get().contracts.find((c) => c.id === id),
  getRecordById: (id) => get().records.find((r) => r.id === id),
  getReviewTaskByRecordId: (recordId) =>
    get().reviewTasks.find((t) => t.recordId === recordId),
  getHistoryByRecordId: (recordId) =>
    get().history.filter((h) => h.recordId === recordId),
  getHistoryByEntityType: (entityType) =>
    get().history.filter((h) => h.entityType === entityType),

  getPendingReviewCount: () =>
    get().reviewTasks.filter((t) => t.reviewStatus === 'pending').length,

  getLateCount: () => get().records.filter((r) => r.isLate).length,

  getTotalRecords: () => get().records.length,
}));
