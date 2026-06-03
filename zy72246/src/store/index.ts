import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AppState,
  TaxNote,
  TaxNoteVersion,
  StatusHistory,
  ReviewRecord,
  ProcessingStatus,
  ProcessStep,
  ActionType,
} from '@/types';
import {
  mockTaxNotes,
  mockVersions,
  mockStatusHistories,
  mockReviewRecords,
} from '@/data/mockData';
import { createVersionRecord, createStatusHistoryRecord, generateUUID } from '@/utils/versionControl';
import { canTransitionStatus, canTransitionStep } from '@/utils/stateMachine';
import { detectFieldChanges } from '@/utils/boundaryRules';

interface AppStore extends AppState {
  dispatch: (action: ActionType) => void;
  resetToMockData: () => void;
}

const initialState: AppState = {
  taxNotes: [],
  versions: [],
  statusHistories: [],
  reviewRecords: [],
  currentUser: '小周',
  filter: {},
};

function reducer(state: AppState, action: ActionType): AppState {
  switch (action.type) {
    case 'LOAD_STATE':
      return { ...state, ...action.payload };

    case 'IMPORT_DATA': {
      const existingIds = new Set(state.taxNotes.map(t => t.id));
      const newTaxNotes = [
        ...state.taxNotes.filter(t => !action.payload.taxNotes.find(n => n.id === t.id)),
        ...action.payload.taxNotes,
      ];
      return {
        ...state,
        taxNotes: newTaxNotes,
        versions: [...state.versions, ...action.payload.versions],
        statusHistories: [...state.statusHistories, ...action.payload.statusHistories],
      };
    }

    case 'UPDATE_TAX_NOTE': {
      const { id, updates, reason } = action.payload;
      const taxNoteIndex = state.taxNotes.findIndex(t => t.id === id);
      if (taxNoteIndex === -1) return state;

      const existingNote = state.taxNotes[taxNoteIndex];
      const changes = detectFieldChanges(existingNote, updates);

      if (changes.length === 0) return state;

      const newVersions: TaxNoteVersion[] = [];
      const newVersionNumber = existingNote.version + 1;

      for (const change of changes) {
        newVersions.push(
          createVersionRecord(
            id,
            newVersionNumber,
            change.field,
            change.oldValue,
            change.newValue,
            state.currentUser,
            reason
          )
        );
      }

      const updatedNote: TaxNote = {
        ...existingNote,
        ...updates,
        version: newVersionNumber,
        updatedBy: state.currentUser,
        updatedAt: new Date().toISOString(),
      };

      const newTaxNotes = [...state.taxNotes];
      newTaxNotes[taxNoteIndex] = updatedNote;

      return {
        ...state,
        taxNotes: newTaxNotes,
        versions: [...state.versions, ...newVersions],
      };
    }

    case 'CHANGE_STATUS': {
      const { id, toStatus, remark } = action.payload;
      const taxNoteIndex = state.taxNotes.findIndex(t => t.id === id);
      if (taxNoteIndex === -1) return state;

      const existingNote = state.taxNotes[taxNoteIndex];

      if (!canTransitionStatus(existingNote.processingStatus, toStatus)) {
        console.error(`无法从 ${existingNote.processingStatus} 转换到 ${toStatus}`);
        return state;
      }

      let newStep = existingNote.currentStep;
      if (toStatus === ProcessingStatus.SUPPLEMENT_COMPLETED) {
        if (canTransitionStep(existingNote.currentStep, ProcessStep.STEP_2_SUPPLEMENT)) {
          newStep = ProcessStep.STEP_2_SUPPLEMENT;
        }
      } else if (toStatus === ProcessingStatus.PENDING_APPROVAL || toStatus === ProcessingStatus.COMPLETED) {
        if (canTransitionStep(existingNote.currentStep, ProcessStep.STEP_3_SUMMARY)) {
          newStep = ProcessStep.STEP_3_SUMMARY;
        }
      } else if (toStatus === ProcessingStatus.PENDING) {
        newStep = ProcessStep.STEP_1_IMPORT;
      }

      const statusHistory = createStatusHistoryRecord(
        id,
        existingNote.processingStatus,
        toStatus,
        state.currentUser,
        remark
      );

      const versionRecord = createVersionRecord(
        id,
        existingNote.version + 1,
        'processingStatus',
        existingNote.processingStatus,
        toStatus,
        state.currentUser,
        remark
      );

      const updatedNote: TaxNote = {
        ...existingNote,
        processingStatus: toStatus,
        currentStep: newStep,
        version: existingNote.version + 1,
        updatedBy: state.currentUser,
        updatedAt: new Date().toISOString(),
      };

      const newTaxNotes = [...state.taxNotes];
      newTaxNotes[taxNoteIndex] = updatedNote;

      return {
        ...state,
        taxNotes: newTaxNotes,
        statusHistories: [...state.statusHistories, statusHistory],
        versions: [...state.versions, versionRecord],
      };
    }

    case 'REVIEW_RECORD': {
      const { id, result, opinion } = action.payload;
      const taxNoteIndex = state.taxNotes.findIndex(t => t.id === id);
      if (taxNoteIndex === -1) return state;

      const existingNote = state.taxNotes[taxNoteIndex];

      const reviewRecord: ReviewRecord = {
        id: generateUUID(),
        taxNoteId: id,
        reviewResult: result,
        reviewOpinion: opinion,
        reviewedBy: state.currentUser,
        reviewedAt: new Date().toISOString(),
        isReversed: false,
      };

      const newStatus = result === 'APPROVED' ? ProcessingStatus.NORMAL : ProcessingStatus.REJECTED;

      if (!canTransitionStatus(existingNote.processingStatus, newStatus)) {
        console.error(`无法从 ${existingNote.processingStatus} 转换到 ${newStatus}`);
        return state;
      }

      const statusHistory = createStatusHistoryRecord(
        id,
        existingNote.processingStatus,
        newStatus,
        state.currentUser,
        `风控复核${result === 'APPROVED' ? '通过' : '驳回'}: ${opinion}`
      );

      const versionRecord = createVersionRecord(
        id,
        existingNote.version + 1,
        'processingStatus',
        existingNote.processingStatus,
        newStatus,
        state.currentUser,
        `风控复核${result === 'APPROVED' ? '通过' : '驳回'}`
      );

      const updatedNote: TaxNote = {
        ...existingNote,
        processingStatus: newStatus,
        version: existingNote.version + 1,
        updatedBy: state.currentUser,
        updatedAt: new Date().toISOString(),
      };

      const newTaxNotes = [...state.taxNotes];
      newTaxNotes[taxNoteIndex] = updatedNote;

      return {
        ...state,
        taxNotes: newTaxNotes,
        reviewRecords: [...state.reviewRecords, reviewRecord],
        statusHistories: [...state.statusHistories, statusHistory],
        versions: [...state.versions, versionRecord],
      };
    }

    case 'ROLLBACK_STATUS': {
      const { id, reason } = action.payload;
      const statusHistoriesForNote = state.statusHistories
        .filter(h => h.taxNoteId === id)
        .sort((a, b) => new Date(b.operatedAt).getTime() - new Date(a.operatedAt).getTime());

      if (statusHistoriesForNote.length < 2) {
        console.error('没有足够的历史记录进行回滚');
        return state;
      }

      const currentHistory = statusHistoriesForNote[0];
      const previousStatus = currentHistory.fromStatus;

      if (!previousStatus) {
        console.error('无法回滚到初始状态之前');
        return state;
      }

      const taxNoteIndex = state.taxNotes.findIndex(t => t.id === id);
      if (taxNoteIndex === -1) return state;

      const existingNote = state.taxNotes[taxNoteIndex];

      const statusHistory = createStatusHistoryRecord(
        id,
        existingNote.processingStatus,
        previousStatus,
        state.currentUser,
        `回滚: ${reason}`
      );

      const versionRecord = createVersionRecord(
        id,
        existingNote.version + 1,
        'processingStatus',
        existingNote.processingStatus,
        previousStatus,
        state.currentUser,
        `回滚: ${reason}`
      );

      const reviewRecordIndex = state.reviewRecords.findIndex(
        r => r.taxNoteId === id && !r.isReversed
      );
      let newReviewRecords = state.reviewRecords;
      if (reviewRecordIndex !== -1) {
        newReviewRecords = [...state.reviewRecords];
        newReviewRecords[reviewRecordIndex] = {
          ...newReviewRecords[reviewRecordIndex],
          isReversed: true,
          reversedBy: state.currentUser,
          reversedAt: new Date().toISOString(),
        };
      }

      const updatedNote: TaxNote = {
        ...existingNote,
        processingStatus: previousStatus,
        version: existingNote.version + 1,
        updatedBy: state.currentUser,
        updatedAt: new Date().toISOString(),
      };

      const newTaxNotes = [...state.taxNotes];
      newTaxNotes[taxNoteIndex] = updatedNote;

      return {
        ...state,
        taxNotes: newTaxNotes,
        statusHistories: [...state.statusHistories, statusHistory],
        versions: [...state.versions, versionRecord],
        reviewRecords: newReviewRecords,
      };
    }

    case 'SET_FILTER':
      return {
        ...state,
        filter: { ...state.filter, ...action.payload },
      };

    default:
      return state;
  }
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      dispatch: (action: ActionType) => {
        set(state => reducer(state, action));
      },
      resetToMockData: () => {
        set({
          taxNotes: mockTaxNotes,
          versions: mockVersions,
          statusHistories: mockStatusHistories,
          reviewRecords: mockReviewRecords,
          currentUser: '小周',
          filter: {},
        });
      },
    }),
    {
      name: 'hkt-share-tax-review-storage',
      onRehydrateStorage: () => (state) => {
        if (state && state.taxNotes.length === 0) {
          state.taxNotes = mockTaxNotes;
          state.versions = mockVersions;
          state.statusHistories = mockStatusHistories;
          state.reviewRecords = mockReviewRecords;
        }
      },
    }
  )
);

export function useFilteredTaxNotes() {
  const { taxNotes, filter } = useAppStore();

  return taxNotes.filter(note => {
    if (filter.status && note.processingStatus !== filter.status) return false;
    if (filter.step && note.currentStep !== filter.step) return false;
    if (filter.keyword) {
      const keyword = filter.keyword.toLowerCase();
      return (
        note.stockCode.toLowerCase().includes(keyword) ||
        note.stockName.toLowerCase().includes(keyword) ||
        note.currentRemark.toLowerCase().includes(keyword) ||
        note.originalRemark.toLowerCase().includes(keyword) ||
        note.serialNumber.toLowerCase().includes(keyword)
      );
    }
    return true;
  }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function useTaxNoteById(id: string) {
  const taxNotes = useAppStore(state => state.taxNotes);
  return taxNotes.find(t => t.id === id);
}

export function useVersionsByTaxNoteId(id: string) {
  const versions = useAppStore(state => state.versions);
  return versions
    .filter(v => v.taxNoteId === id)
    .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
}

export function useStatusHistoryByTaxNoteId(id: string) {
  const statusHistories = useAppStore(state => state.statusHistories);
  return statusHistories
    .filter(h => h.taxNoteId === id)
    .sort((a, b) => new Date(b.operatedAt).getTime() - new Date(a.operatedAt).getTime());
}

export function useReviewRecordsByTaxNoteId(id: string) {
  const reviewRecords = useAppStore(state => state.reviewRecords);
  return reviewRecords
    .filter(r => r.taxNoteId === id)
    .sort((a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime());
}

export function usePendingReviewNotes() {
  const taxNotes = useAppStore(state => state.taxNotes);
  return taxNotes
    .filter(n => n.processingStatus === ProcessingStatus.REVERSAL_PENDING_REVIEW)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
