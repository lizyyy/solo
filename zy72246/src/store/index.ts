import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import {
  AppState, TaxNote, TaxNoteVersion, StatusHistory,
  ReviewRecord, BalanceChangeRecord, DuplicateResolution,
  ProcessingStatus, ProcessStep, ActionType,
} from "@/types";
import {
  mockTaxNotes, mockVersions, mockStatusHistories,
  mockReviewRecords, mockBalanceChanges,
} from "@/data/mockData";
import { createVersionRecord, createStatusHistoryRecord, generateUUID } from "@/utils/versionControl";
import { canTransitionStatus, canTransitionStep } from "@/utils/stateMachine";
import { detectFieldChanges, checkBalanceUpdatePrerequisite, alignCounterTailRemark } from "@/utils/boundaryRules";

interface AppStore extends AppState {
  dispatch: (action: ActionType) => void;
  resetToMockData: () => void;
}

const initialState: AppState = {
  taxNotes: [], versions: [], statusHistories: [],
  reviewRecords: [], balanceChanges: [],
  currentUser: "小周", filter: {},
};

function reducer(state: AppState, action: ActionType): AppState {
  switch (action.type) {
    case 'LOAD_STATE':
      return { ...state, ...action.payload };

    case 'IMPORT_DATA': {
      const { taxNotes, versions, statusHistories } = action.payload;
      const mergedTaxNotes = [...state.taxNotes];
      const newVersions = [...state.versions, ...versions];
      const newStatusHistories = [...state.statusHistories, ...statusHistories];

      for (const note of taxNotes) {
        const existingIndex = mergedTaxNotes.findIndex(n => n.id === note.id);
        if (existingIndex >= 0) {
          mergedTaxNotes[existingIndex] = {
            ...mergedTaxNotes[existingIndex],
            ...note,
            version: Math.max(mergedTaxNotes[existingIndex].version, note.version),
          };
        } else {
          mergedTaxNotes.push(note);
        }
      }

      return {
        ...state,
        taxNotes: mergedTaxNotes,
        versions: newVersions,
        statusHistories: newStatusHistories,
      };
    }

    case 'UPDATE_TAX_NOTE': {
      const { id, updates, reason } = action.payload;
      const taxNoteIndex = state.taxNotes.findIndex(n => n.id === id);
      if (taxNoteIndex === -1) return state;

      const existing = state.taxNotes[taxNoteIndex];
      let alignedUpdates = { ...updates };

      if (updates.counterTailNumber && updates.counterTailNumber !== existing.counterTailNumber) {
        const alignedRemark = alignCounterTailRemark(
          updates.currentRemark || existing.currentRemark,
          updates.counterTailNumber
        );
        if (alignedRemark !== (updates.currentRemark || existing.currentRemark)) {
          alignedUpdates.currentRemark = alignedRemark;
        }
      }

      const fieldChanges = detectFieldChanges(existing, alignedUpdates);
      if (fieldChanges.length === 0) return state;

      const newVersion = existing.version + 1;
      const updatedTaxNote: TaxNote = {
        ...existing,
        ...alignedUpdates,
        version: newVersion,
        updatedBy: state.currentUser,
        updatedAt: new Date().toISOString(),
      };

      const versionRecords: TaxNoteVersion[] = fieldChanges.map(change =>
        createVersionRecord(
          id,
          newVersion,
          change.field,
          change.oldValue,
          change.newValue,
          state.currentUser,
          reason
        )
      );

      const newTaxNotes = [...state.taxNotes];
      newTaxNotes[taxNoteIndex] = updatedTaxNote;

      return {
        ...state,
        taxNotes: newTaxNotes,
        versions: [...state.versions, ...versionRecords],
      };
    }

    case 'CHANGE_STATUS': {
      const { id, toStatus, remark } = action.payload;
      const taxNoteIndex = state.taxNotes.findIndex(n => n.id === id);
      if (taxNoteIndex === -1) return state;

      const taxNote = state.taxNotes[taxNoteIndex];

      if (!canTransitionStatus(taxNote.processingStatus, toStatus)) {
        console.error(`状态流转被拒绝: ${taxNote.processingStatus} → ${toStatus}`);
        return state;
      }

      if (toStatus === ProcessingStatus.BALANCE_UPDATED) {
        const check = checkBalanceUpdatePrerequisite(taxNote);
        if (!check.canProceed) {
          console.error(`余额更新前置检查未通过: ${check.reason} (规则: ${check.ruleId})`);
          return state;
        }
      }

      const newVersion = taxNote.version + 1;
      let newStep = taxNote.currentStep;

      switch (toStatus) {
        case ProcessingStatus.SUPPLEMENT_COMPLETED:
          newStep = ProcessStep.STEP_2_SUPPLEMENT;
          break;
        case ProcessingStatus.BALANCE_UPDATED:
          newStep = ProcessStep.STEP_3_BALANCE;
          break;
        case ProcessingStatus.PENDING_APPROVAL:
        case ProcessingStatus.COMPLETED:
          newStep = ProcessStep.STEP_4_SUMMARY;
          break;
        case ProcessingStatus.PENDING:
          newStep = ProcessStep.STEP_1_IMPORT;
          break;
        default:
          break;
      }

      const updatedTaxNote: TaxNote = {
        ...taxNote,
        processingStatus: toStatus,
        currentStep: newStep,
        version: newVersion,
        updatedBy: state.currentUser,
        updatedAt: new Date().toISOString(),
      };

      const statusHistory = createStatusHistoryRecord(
        id,
        taxNote.processingStatus,
        toStatus,
        state.currentUser,
        remark
      );

      const versionRecord = createVersionRecord(
        id,
        newVersion,
        'processingStatus',
        taxNote.processingStatus,
        toStatus,
        state.currentUser,
        remark
      );

      const newTaxNotes = [...state.taxNotes];
      newTaxNotes[taxNoteIndex] = updatedTaxNote;

      return {
        ...state,
        taxNotes: newTaxNotes,
        statusHistories: [...state.statusHistories, statusHistory],
        versions: [...state.versions, versionRecord],
      };
    }

    case 'REVIEW_RECORD': {
      const { id, result, opinion } = action.payload;
      const taxNoteIndex = state.taxNotes.findIndex(n => n.id === id);
      if (taxNoteIndex === -1) return state;

      const taxNote = state.taxNotes[taxNoteIndex];
      const newVersion = taxNote.version + 1;

      const reviewRecord: ReviewRecord = {
        id: generateUUID(),
        taxNoteId: id,
        reviewResult: result,
        reviewOpinion: opinion,
        reviewedBy: state.currentUser,
        reviewedAt: new Date().toISOString(),
        isReversed: false,
      };

      const newStatus = result === 'APPROVED'
        ? ProcessingStatus.NORMAL
        : ProcessingStatus.REJECTED;

      if (!canTransitionStatus(taxNote.processingStatus, newStatus)) {
        return state;
      }

      const updatedTaxNote: TaxNote = {
        ...taxNote,
        processingStatus: newStatus,
        version: newVersion,
        updatedBy: state.currentUser,
        updatedAt: new Date().toISOString(),
      };

      const statusHistory = createStatusHistoryRecord(
        id,
        taxNote.processingStatus,
        newStatus,
        state.currentUser,
        result === 'APPROVED'
          ? `风控复核通过: ${opinion}`
          : `风控复核驳回: ${opinion}`
      );

      const versionRecord = createVersionRecord(
        id,
        newVersion,
        'processingStatus',
        taxNote.processingStatus,
        newStatus,
        state.currentUser,
        result === 'APPROVED'
          ? `风控复核通过: ${opinion}`
          : `风控复核驳回: ${opinion}`
      );

      const newTaxNotes = [...state.taxNotes];
      newTaxNotes[taxNoteIndex] = updatedTaxNote;

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
      const taxNoteIndex = state.taxNotes.findIndex(n => n.id === id);
      if (taxNoteIndex === -1) return state;

      const taxNote = state.taxNotes[taxNoteIndex];
      const historiesForNote = state.statusHistories
        .filter(h => h.taxNoteId === id)
        .sort((a, b) => new Date(b.operatedAt).getTime() - new Date(a.operatedAt).getTime());

      if (historiesForNote.length === 0) return state;

      const lastHistory = historiesForNote[0];
      if (!lastHistory.fromStatus) return state;

      const previousStatus = lastHistory.fromStatus;
      const newVersion = taxNote.version + 1;

      let newStep = taxNote.currentStep;
      switch (previousStatus) {
        case ProcessingStatus.PENDING:
          newStep = ProcessStep.STEP_1_IMPORT;
          break;
        case ProcessingStatus.SUPPLEMENT_COMPLETED:
          newStep = ProcessStep.STEP_2_SUPPLEMENT;
          break;
        case ProcessingStatus.BALANCE_UPDATED:
          newStep = ProcessStep.STEP_3_BALANCE;
          break;
        case ProcessingStatus.PENDING_APPROVAL:
        case ProcessingStatus.COMPLETED:
          newStep = ProcessStep.STEP_4_SUMMARY;
          break;
        case ProcessingStatus.REVERSAL_PENDING_REVIEW:
        case ProcessingStatus.NORMAL:
        case ProcessingStatus.REJECTED:
        default:
          break;
      }

      const updatedTaxNote: TaxNote = {
        ...taxNote,
        processingStatus: previousStatus,
        currentStep: newStep,
        version: newVersion,
        updatedBy: state.currentUser,
        updatedAt: new Date().toISOString(),
      };

      const statusHistory = createStatusHistoryRecord(
        id,
        taxNote.processingStatus,
        previousStatus,
        state.currentUser,
        `回滚: ${reason}`
      );

      const versionRecord = createVersionRecord(
        id,
        newVersion,
        'processingStatus',
        taxNote.processingStatus,
        previousStatus,
        state.currentUser,
        `回滚: ${reason}`
      );

      const newTaxNotes = [...state.taxNotes];
      newTaxNotes[taxNoteIndex] = updatedTaxNote;

      return {
        ...state,
        taxNotes: newTaxNotes,
        statusHistories: [...state.statusHistories, statusHistory],
        versions: [...state.versions, versionRecord],
      };
    }

    case 'GENERATE_BALANCE_CHANGE': {
      const { balanceChange, taxNoteUpdates } = action.payload;
      let newState: AppState = {
        ...state,
        balanceChanges: [...state.balanceChanges, balanceChange],
      };

      if (taxNoteUpdates) {
        const { id: updateId, updates, reason } = taxNoteUpdates;
        const updateIndex = newState.taxNotes.findIndex(n => n.id === updateId);
        if (updateIndex !== -1) {
          const existing = newState.taxNotes[updateIndex];
          const fieldChanges = detectFieldChanges(existing, updates);
          const newVersion = existing.version + 1;

          const updatedTaxNote: TaxNote = {
            ...existing,
            ...updates,
            version: newVersion,
            updatedBy: state.currentUser,
            updatedAt: new Date().toISOString(),
          };

          const versionRecords: TaxNoteVersion[] = fieldChanges.map(change =>
            createVersionRecord(
              updateId,
              newVersion,
              change.field,
              change.oldValue,
              change.newValue,
              state.currentUser,
              reason
            )
          );

          const newTaxNotes = [...newState.taxNotes];
          newTaxNotes[updateIndex] = updatedTaxNote;

          newState = {
            ...newState,
            taxNotes: newTaxNotes,
            versions: [...newState.versions, ...versionRecords],
          };
        }
      }

      return newState;
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
    (set) => ({
      ...initialState,

      dispatch: (action: ActionType) => {
        set((state) => reducer(state, action));
      },

      resetToMockData: () => {
        set({
          taxNotes: mockTaxNotes,
          versions: mockVersions,
          statusHistories: mockStatusHistories,
          reviewRecords: mockReviewRecords,
          balanceChanges: mockBalanceChanges,
          currentUser: "小周",
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
          state.balanceChanges = mockBalanceChanges;
        }
      },
    }
  )
);

export function useFilteredTaxNotes(): TaxNote[] {
  const { taxNotes, filter } = useAppStore(
    useShallow((state) => ({ taxNotes: state.taxNotes, filter: state.filter }))
  );
  return taxNotes.filter(note => {
    if (filter.status && note.processingStatus !== filter.status) return false;
    if (filter.step && note.currentStep !== filter.step) return false;
    if (filter.keyword) {
      const kw = filter.keyword.toLowerCase();
      const matchesKeyword =
        note.stockName.toLowerCase().includes(kw) ||
        note.stockCode.includes(kw) ||
        note.serialNumber.toLowerCase().includes(kw) ||
        note.currentRemark.toLowerCase().includes(kw) ||
        note.originalRemark.toLowerCase().includes(kw);
      if (!matchesKeyword) return false;
    }
    return true;
  });
}

export function useTaxNoteById(id: string): TaxNote | undefined {
  return useAppStore((state) => state.taxNotes.find(n => n.id === id));
}

export function useVersionsByTaxNoteId(taxNoteId: string): TaxNoteVersion[] {
  const versions = useAppStore(useShallow((state) => state.versions));
  return versions
    .filter(v => v.taxNoteId === taxNoteId)
    .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
}

export function useStatusHistoryByTaxNoteId(taxNoteId: string): StatusHistory[] {
  const statusHistories = useAppStore(useShallow((state) => state.statusHistories));
  return statusHistories
    .filter(h => h.taxNoteId === taxNoteId)
    .sort((a, b) => new Date(b.operatedAt).getTime() - new Date(a.operatedAt).getTime());
}

export function usePendingReviewNotes(): TaxNote[] {
  const taxNotes = useAppStore(useShallow((state) => state.taxNotes));
  return taxNotes.filter(n => n.processingStatus === ProcessingStatus.REVERSAL_PENDING_REVIEW);
}

export function useReviewRecordsByTaxNoteId(taxNoteId: string): ReviewRecord[] {
  const reviewRecords = useAppStore(useShallow((state) => state.reviewRecords));
  return reviewRecords
    .filter(r => r.taxNoteId === taxNoteId)
    .sort((a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime());
}
