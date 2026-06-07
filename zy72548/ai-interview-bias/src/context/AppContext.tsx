import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AppState, ReviewRecord, Role, PromptVersion } from '../types';
import { loadState, saveState } from '../utils/storage';
import { detectConflicts, createHistoryRecord } from '../utils/business';

type Action =
  | { type: 'SET_ROLE'; payload: { role: Role; user: string } }
  | { type: 'SET_ACTIVE_TAB'; payload: AppState['activeTab'] }
  | { type: 'SELECT_SAMPLE'; payload: string | undefined }
  | { type: 'ADD_REVIEW_RECORDS'; payload: ReviewRecord[] }
  | { type: 'UPDATE_REVIEW_RECORD'; payload: ReviewRecord }
  | { type: 'ADD_PROMPT_VERSION'; payload: PromptVersion }
  | { type: 'APPLY_PROMPT_VERSION'; payload: { sampleId: string; promptVersion: PromptVersion } }
  | { type: 'RESOLVE_CONFLICT'; payload: { sampleId: string; conflictId: string; resolution: 'confirm' | 'reject' | 'operation_review'; operator: string } }
  | { type: 'PM_CONFIRM'; payload: { sampleId: string; operator: string } }
  | { type: 'PM_REJECT'; payload: { sampleId: string; operator: string; reason: string } }
  | { type: 'OPERATION_APPROVE'; payload: { sampleId: string; operator: string } }
  | { type: 'OPERATION_REJECT'; payload: { sampleId: string; operator: string; reason: string } }
  | { type: 'FINALIZE_RECORD'; payload: { sampleId: string; operator: string } }
  | { type: 'RESET_STATE' };

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

const appReducer = (state: AppState, action: Action): AppState => {
  let newState: AppState;

  switch (action.type) {
    case 'SET_ROLE':
      newState = {
        ...state,
        currentRole: action.payload.role,
        currentUser: action.payload.user,
      };
      break;

    case 'SET_ACTIVE_TAB':
      newState = {
        ...state,
        activeTab: action.payload,
      };
      break;

    case 'SELECT_SAMPLE':
      newState = {
        ...state,
        selectedSampleId: action.payload,
      };
      break;

    case 'ADD_REVIEW_RECORDS': {
      const recordsWithConflicts = action.payload.map(record => {
        const conflicts = detectConflicts(record, state.reviewRecords);
        const hasUnresolvedConflicts = conflicts.length > 0;
        return {
          ...record,
          conflicts,
          status: hasUnresolvedConflicts ? 'conflict_detected' : record.status,
          history: hasUnresolvedConflicts
            ? [
                ...record.history,
                createHistoryRecord(
                  record.sampleId,
                  '检测到冲突',
                  'system',
                  'admin',
                  undefined,
                  { conflicts },
                  `检测到 ${conflicts.length} 个冲突`
                ),
              ]
            : record.history,
          updatedAt: new Date().toISOString(),
        };
      });
      newState = {
        ...state,
        reviewRecords: [...state.reviewRecords, ...recordsWithConflicts],
      };
      break;
    }

    case 'UPDATE_REVIEW_RECORD':
      newState = {
        ...state,
        reviewRecords: state.reviewRecords.map(r =>
          r.sampleId === action.payload.sampleId ? action.payload : r
        ),
      };
      break;

    case 'ADD_PROMPT_VERSION':
      newState = {
        ...state,
        promptVersions: [...state.promptVersions, action.payload],
      };
      break;

    case 'APPLY_PROMPT_VERSION': {
      const { sampleId, promptVersion } = action.payload;
      newState = {
        ...state,
        reviewRecords: state.reviewRecords.map(r => {
          if (r.sampleId !== sampleId) return r;
          const updated = {
            ...r,
            promptVersion,
            updatedAt: new Date().toISOString(),
            history: [
              ...r.history,
              createHistoryRecord(
                sampleId,
                '补录提示词版本',
                state.currentUser,
                state.currentRole,
                { promptVersion: r.promptVersion },
                { promptVersion },
                `补录提示词版本 ${promptVersion.versionNumber}`
              ),
            ],
          };
          const newConflicts = detectConflicts(updated, state.reviewRecords.filter(x => x.sampleId !== sampleId));
          const existingUnresolved = r.conflicts.filter(c => !c.resolved);
          const allConflicts = [...existingUnresolved, ...newConflicts];
          return {
            ...updated,
            conflicts: allConflicts,
            status: allConflicts.length > 0 ? 'conflict_detected' : updated.status,
          };
        }),
      };
      break;
    }

    case 'RESOLVE_CONFLICT': {
      const { sampleId, conflictId, resolution, operator } = action.payload;
      const now = new Date().toISOString();
      newState = {
        ...state,
        reviewRecords: state.reviewRecords.map(r => {
          if (r.sampleId !== sampleId) return r;
          const updatedConflicts = r.conflicts.map(c =>
            c.conflictId === conflictId
              ? { ...c, resolved: true, resolvedBy: operator, resolvedAt: now, resolution }
              : c
          );
          const hasUnresolved = updatedConflicts.some(c => !c.resolved);
          let newStatus = r.status;
          if (!hasUnresolved && resolution === 'confirm') {
            newStatus = 'pm_confirmed';
          } else if (!hasUnresolved && resolution === 'operation_review') {
            newStatus = 'pending_operation';
          }
          return {
            ...r,
            conflicts: updatedConflicts,
            status: newStatus,
            history: [
              ...r.history,
              createHistoryRecord(
                sampleId,
                '处理冲突',
                operator,
                state.currentRole,
                { conflictId },
                { resolution },
                resolution === 'confirm' ? '确认冲突，继续流程' :
                resolution === 'reject' ? '驳回冲突数据' :
                '提交运营复核'
              ),
            ],
            updatedAt: now,
          };
        }),
      };
      break;
    }

    case 'PM_CONFIRM': {
      const { sampleId, operator } = action.payload;
      const now = new Date().toISOString();
      newState = {
        ...state,
        reviewRecords: state.reviewRecords.map(r => {
          if (r.sampleId !== sampleId) return r;
          const hasModelConflict = r.conflicts.some(
            c => c.type === 'model_version_changed' && !c.resolved
          );
          return {
            ...r,
            status: hasModelConflict ? 'pending_operation' : 'pm_confirmed',
            history: [
              ...r.history,
              createHistoryRecord(
                sampleId,
                '产品经理确认',
                operator,
                'product_manager',
                { status: r.status },
                { status: hasModelConflict ? 'pending_operation' : 'pm_confirmed' },
                hasModelConflict ? '检测到模型版本变更，转运营复核' : '产品经理确认无误'
              ),
            ],
            updatedAt: now,
          };
        }),
      };
      break;
    }

    case 'PM_REJECT': {
      const { sampleId, operator, reason } = action.payload;
      const now = new Date().toISOString();
      newState = {
        ...state,
        reviewRecords: state.reviewRecords.map(r => {
          if (r.sampleId !== sampleId) return r;
          return {
            ...r,
            status: 'pm_rejected',
            history: [
              ...r.history,
              createHistoryRecord(
                sampleId,
                '产品经理驳回',
                operator,
                'product_manager',
                { status: r.status },
                { status: 'pm_rejected' },
                reason
              ),
            ],
            updatedAt: now,
          };
        }),
      };
      break;
    }

    case 'OPERATION_APPROVE': {
      const { sampleId, operator } = action.payload;
      const now = new Date().toISOString();
      newState = {
        ...state,
        reviewRecords: state.reviewRecords.map(r => {
          if (r.sampleId !== sampleId) return r;
          return {
            ...r,
            status: 'operation_approved',
            finalScore: r.correction?.humanScore ?? r.interview.aiScore,
            finalConclusion: r.correction?.conclusion ?? (r.interview.aiScore >= 60 ? '通过' : '不通过'),
            history: [
              ...r.history,
              createHistoryRecord(
                sampleId,
                '运营复核通过',
                operator,
                'operation_reviewer',
                { status: r.status },
                { status: 'operation_approved', finalScore: r.correction?.humanScore },
                '模型版本变更复核通过'
              ),
            ],
            updatedAt: now,
          };
        }),
      };
      break;
    }

    case 'OPERATION_REJECT': {
      const { sampleId, operator, reason } = action.payload;
      const now = new Date().toISOString();
      newState = {
        ...state,
        reviewRecords: state.reviewRecords.map(r => {
          if (r.sampleId !== sampleId) return r;
          return {
            ...r,
            status: 'operation_rejected',
            history: [
              ...r.history,
              createHistoryRecord(
                sampleId,
                '运营复核驳回',
                operator,
                'operation_reviewer',
                { status: r.status },
                { status: 'operation_rejected' },
                reason
              ),
            ],
            updatedAt: now,
          };
        }),
      };
      break;
    }

    case 'FINALIZE_RECORD': {
      const { sampleId, operator } = action.payload;
      const now = new Date().toISOString();
      newState = {
        ...state,
        reviewRecords: state.reviewRecords.map(r => {
          if (r.sampleId !== sampleId) return r;
          return {
            ...r,
            status: 'finalized',
            history: [
              ...r.history,
              createHistoryRecord(
                sampleId,
                '归档',
                operator,
                state.currentRole,
                { status: r.status },
                { status: 'finalized' },
                '记录已归档，可在复盘页查看'
              ),
            ],
            updatedAt: now,
          };
        }),
      };
      break;
    }

    case 'RESET_STATE':
      newState = {
        currentRole: 'product_manager',
        currentUser: '阿宁',
        reviewRecords: [],
        promptVersions: [],
        activeTab: 'import',
      };
      break;

    default:
      return state;
  }

  saveState(newState);
  return newState;
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, undefined, loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
