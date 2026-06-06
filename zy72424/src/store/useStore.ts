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
import { recordChange } from '../utils/historyTracker';
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
  updateContract: (id: string, updates: Partial<ContractScreenshot>) => void;
  addTrackAlias: (alias: TrackAlias) => void;
  updateTrackAlias: (id: string, updates: Partial<TrackAlias>, changedBy: string) => void;
  addRecord: (record: RehearsalRecord) => void;
  updateRecord: (id: string, updates: Partial<RehearsalRecord>, changedBy: string) => void;
  addHistory: (history: ChangeHistory) => void;
  updateReviewTask: (id: string, updates: Partial<ReviewTask>) => void;
  processRecordWithReworkCheck: (recordId: string) => void;
  setSelectedRecordId: (id: string | null) => void;
  setSelectedContractId: (id: string | null) => void;
  setSelectedTrackId: (id: string | null) => void;
  getTrackById: (id: string) => TrackAlias | undefined;
  getContractById: (id: string) => ContractScreenshot | undefined;
  getRecordById: (id: string) => RehearsalRecord | undefined;
  getReviewTaskByRecordId: (recordId: string) => ReviewTask | undefined;
  getHistoryByRecordId: (recordId: string) => ChangeHistory[];
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

  updateContract: (id, updates) =>
    set((state) => ({
      contracts: state.contracts.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),

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

  updateReviewTask: (id, updates) =>
    set((state) => ({
      reviewTasks: state.reviewTasks.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),

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
        recordId,
        record,
        updatedRecord,
        'status',
        '系统',
        'update'
      );
      if (statusChange) newHistory.push(statusChange);

      const reworkChange = recordChange(
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

  getPendingReviewCount: () =>
    get().reviewTasks.filter((t) => t.reviewStatus === 'pending').length,

  getLateCount: () => get().records.filter((r) => r.isLate).length,

  getTotalRecords: () => get().records.length,
}));
