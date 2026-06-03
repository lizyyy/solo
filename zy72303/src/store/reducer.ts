import type { AppState, AppAction, WorkflowStage, RecordStatus, ParameterRecord } from '../types';
import {
  createParameterRecordVersion,
  deduplicateRecords,
} from '../utils/dataUtils';

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'IMPORT_PARAMETER_RECORDS': {
      const { records } = deduplicateRecords(
        action.payload,
        state.parameterRecords
      );
      return {
        ...state,
        parameterRecords: [...state.parameterRecords, ...records],
      };
    }

    case 'UPDATE_PARAMETER_RECORD': {
      const { id, changes, author, description } = action.payload;
      return {
        ...state,
        parameterRecords: state.parameterRecords.map(record => {
          if (record.id !== id) return record;
          const newVersion = createParameterRecordVersion(record, changes, author, description);
          return {
            ...record,
            ...changes,
            versions: [...record.versions, newVersion],
            currentVersion: newVersion.version,
          };
        }),
      };
    }

    case 'ADD_COMPARISON_RESULT': {
      return {
        ...state,
        comparisonResults: [...state.comparisonResults, action.payload],
      };
    }

    case 'UPDATE_COMPARISON_RESULT': {
      const { id, changes } = action.payload;
      return {
        ...state,
        comparisonResults: state.comparisonResults.map(result =>
          result.id === id ? { ...result, ...changes } : result
        ),
      };
    }

    case 'ADD_REVIEW_TASK': {
      return {
        ...state,
        reviewTasks: [...state.reviewTasks, action.payload],
      };
    }

    case 'UPDATE_REVIEW_TASK': {
      const { id, changes } = action.payload;
      return {
        ...state,
        reviewTasks: state.reviewTasks.map(task =>
          task.id === id ? { ...task, ...changes } : task
        ),
      };
    }

    case 'ADVANCE_WORKFLOW_STAGE': {
      const stages: WorkflowStage[] = ['initial_import', 'alan_review', 'classroom_demo'];
      const currentIndex = stages.indexOf(state.workflowStage);
      const nextStage = currentIndex < stages.length - 1 ? stages[currentIndex + 1] : stages[currentIndex];
      return {
        ...state,
        workflowStage: nextStage,
      };
    }

    case 'SET_WORKFLOW_STAGE': {
      return {
        ...state,
        workflowStage: action.payload,
      };
    }

    case 'SET_DISPLAY_MODE': {
      return {
        ...state,
        displayMode: action.payload,
      };
    }

    case 'SELECT_RECORD': {
      return {
        ...state,
        selectedRecordId: action.payload,
        selectedResultId: null,
      };
    }

    case 'SELECT_RESULT': {
      return {
        ...state,
        selectedResultId: action.payload,
        selectedRecordId: action.payload
          ? state.comparisonResults.find(r => r.id === action.payload)?.parameterRecordId || null
          : null,
      };
    }

    case 'SET_CURRENT_USER': {
      return {
        ...state,
        currentUser: action.payload,
      };
    }

    case 'ADD_PARAMETER_VERSION': {
      return {
        ...state,
        parameterVersions: [...state.parameterVersions, action.payload],
        currentParameterVersion: action.payload.version,
      };
    }

    case 'SET_CURRENT_PARAMETER_VERSION': {
      return {
        ...state,
        currentParameterVersion: action.payload,
      };
    }

    case 'SHOW_HISTORY_DIFF': {
      return {
        ...state,
        selectedRecordId: action.payload.recordId,
        showHistoryDiff: true,
        compareVersionFrom: action.payload.fromVersion,
        compareVersionTo: action.payload.toVersion,
      };
    }

    case 'HIDE_HISTORY_DIFF': {
      return {
        ...state,
        showHistoryDiff: false,
        compareVersionFrom: null,
        compareVersionTo: null,
      };
    }

    case 'PROVIDE_COUNTEREXAMPLE': {
      const { recordId, counterexample, author } = action.payload;
      const now = Date.now();
      return {
        ...state,
        parameterRecords: state.parameterRecords.map(record => {
          if (record.id !== recordId) return record;
          const changes = {
            manualCounterexample: counterexample,
            counterexampleProvider: author,
            counterexampleTimestamp: now,
            status: 'counterexample_provided' as const,
          };
          const newVersion = createParameterRecordVersion(
            record,
            changes,
            author,
            '补充手算反例'
          );
          return {
            ...record,
            ...changes,
            versions: [...record.versions, newVersion],
            currentVersion: newVersion.version,
          };
        }),
      };
    }

    case 'APPROVE_RECORD': {
      const { recordId, reviewer, comment } = action.payload;
      const now = Date.now();
      return {
        ...state,
        parameterRecords: state.parameterRecords.map(record => {
          if (record.id !== recordId) return record;
          const changes: Partial<Pick<ParameterRecord, 'reviewStatus' | 'status'>> = {
            reviewStatus: 'approved',
            status: (record.status === 'zero_denominator' ? 'zero_denominator' : 'demo_ready') as RecordStatus,
          };
          const newVersion = createParameterRecordVersion(
            record,
            changes,
            reviewer,
            comment || '数据复核通过'
          );
          return {
            ...record,
            ...changes,
            versions: [...record.versions, newVersion],
            currentVersion: newVersion.version,
          };
        }),
        reviewTasks: state.reviewTasks.map(task =>
          task.parameterRecordId === recordId
            ? { ...task, status: 'approved' as const, completedAt: now, comment }
            : task
        ),
      };
    }

    case 'REJECT_RECORD': {
      const { recordId, reviewer, comment } = action.payload;
      const now = Date.now();
      return {
        ...state,
        parameterRecords: state.parameterRecords.map(record => {
          if (record.id !== recordId) return record;
          const changes = {
            reviewStatus: 'rejected' as const,
          };
          const newVersion = createParameterRecordVersion(
            record,
            changes,
            reviewer,
            comment || '数据复核未通过'
          );
          return {
            ...record,
            ...changes,
            versions: [...record.versions, newVersion],
            currentVersion: newVersion.version,
          };
        }),
        reviewTasks: state.reviewTasks.map(task =>
          task.parameterRecordId === recordId
            ? { ...task, status: 'rejected' as const, completedAt: now, comment }
            : task
        ),
      };
    }

    case 'UPDATE_CLASSROOM_NOTE': {
      const { resultId, note } = action.payload;
      return {
        ...state,
        comparisonResults: state.comparisonResults.map(result =>
          result.id === resultId
            ? { ...result, classroomNote: note }
            : result
        ),
      };
    }

    case 'MARK_DEMO_UPDATED': {
      return {
        ...state,
        comparisonResults: state.comparisonResults.map(result =>
          result.id === action.payload.resultId
            ? { ...result, demoUpdated: true }
            : result
        ),
      };
    }

    default:
      return state;
  }
}
