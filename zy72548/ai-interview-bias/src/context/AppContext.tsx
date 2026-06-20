import React, { useReducer, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AppState } from '../types';
import type { Action } from '../types/context';
import { loadState, saveState } from '../utils/storage';
import { detectConflicts, createHistoryRecord, getRelatedRecords } from '../utils/business';
import { AppContext } from './context';

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

    case 'SELECT_RECORD':
      newState = {
        ...state,
        selectedRecordId: action.payload,
      };
      break;

    case 'ADD_REVIEW_RECORDS': {
      const recordsWithConflicts = action.payload.map(record => {
        const conflicts = detectConflicts(record, state.reviewRecords);
        const hasUnresolvedConflicts = conflicts.length > 0;
        const related = getRelatedRecords(record, state.reviewRecords);
        const relatedInfo = related.length > 0
          ? `（同样本编号还有 ${related.length} 条不同模型版本记录：${related.map(r => r.interview.modelVersion).join('、')}）`
          : '';
        return {
          ...record,
          conflicts,
          status: hasUnresolvedConflicts ? 'conflict_detected' : record.status,
          history: [
            ...record.history,
            ...(hasUnresolvedConflicts
              ? [createHistoryRecord(
                  record.recordId,
                  record.sampleId,
                  '检测到冲突',
                  'system',
                  'admin',
                  undefined,
                  { conflicts },
                  `检测到 ${conflicts.length} 个冲突`
                )]
              : []),
            ...(related.length > 0
              ? [createHistoryRecord(
                  record.recordId,
                  record.sampleId,
                  '关联记录提示',
                  'system',
                  'admin',
                  undefined,
                  { relatedRecordIds: related.map(r => r.recordId) },
                  relatedInfo
                )]
              : []),
          ],
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
          r.recordId === action.payload.recordId ? action.payload : r
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
      const { recordId, promptVersion } = action.payload;
      newState = {
        ...state,
        reviewRecords: state.reviewRecords.map(r => {
          if (r.recordId !== recordId) return r;
          const updated = {
            ...r,
            promptVersion,
            updatedAt: new Date().toISOString(),
            history: [
              ...r.history,
              createHistoryRecord(
                recordId,
                r.sampleId,
                '补录提示词版本',
                state.currentUser,
                state.currentRole,
                { promptVersion: r.promptVersion ? r.promptVersion.versionNumber : '无' },
                { promptVersion: promptVersion.versionNumber },
                `补录提示词版本 ${promptVersion.versionNumber}`
              ),
            ],
          };
          const newConflicts = detectConflicts(updated, state.reviewRecords.filter(x => x.recordId !== recordId));
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
      const { recordId, conflictId, resolution, operator } = action.payload;
      const now = new Date().toISOString();
      newState = {
        ...state,
        reviewRecords: state.reviewRecords.map(r => {
          if (r.recordId !== recordId) return r;
          const updatedConflicts = r.conflicts.map(c =>
            c.conflictId === conflictId
              ? { ...c, resolved: true, resolvedBy: operator, resolvedAt: now, resolution }
              : c
          );
          const hasUnresolved = updatedConflicts.some(c => !c.resolved);
          const related = getRelatedRecords(r, state.reviewRecords);
          const hasOtherModelVersions = related.length > 0;
          let newStatus = r.status;
          if (!hasUnresolved && resolution === 'confirm') {
            newStatus = hasOtherModelVersions ? 'pending_operation' : 'pm_confirmed';
          } else if (!hasUnresolved && resolution === 'operation_review') {
            newStatus = 'pending_operation';
          }
          const conflictRemark = resolution === 'confirm' 
            ? (hasOtherModelVersions 
              ? '确认冲突，但同样本编号存在不同模型版本记录，转运营复核' 
              : '确认冲突，继续流程')
            : resolution === 'reject' ? '驳回冲突数据' : '提交运营复核';
          return {
            ...r,
            conflicts: updatedConflicts,
            status: newStatus,
            history: [
              ...r.history,
              createHistoryRecord(
                recordId,
                r.sampleId,
                '处理冲突',
                operator,
                state.currentRole,
                { conflictId, status: r.status },
                { resolution, status: newStatus },
                conflictRemark
              ),
            ],
            updatedAt: now,
          };
        }),
      };
      break;
    }

    case 'PM_CONFIRM': {
      const { recordId, operator } = action.payload;
      const now = new Date().toISOString();
      newState = {
        ...state,
        reviewRecords: state.reviewRecords.map(r => {
          if (r.recordId !== recordId) return r;
          const related = getRelatedRecords(r, state.reviewRecords);
          const hasOtherModelVersions = related.length > 0;
          const targetStatus = hasOtherModelVersions ? 'pending_operation' : 'pm_confirmed';
          const finalScore = r.correction?.humanScore ?? r.interview.aiScore;
          const finalConclusion = r.correction?.conclusion ?? (r.interview.aiScore >= 60 ? '通过' : '不通过');
          return {
            ...r,
            status: targetStatus,
            ...(hasOtherModelVersions ? {} : { finalScore, finalConclusion }),
            history: [
              ...r.history,
              createHistoryRecord(
                recordId,
                r.sampleId,
                '产品经理确认',
                operator,
                'product_manager',
                { status: r.status },
                { status: targetStatus },
                hasOtherModelVersions
                  ? `同样本编号存在不同模型版本记录（${related.map(x => x.interview.modelVersion).join('、')}），转运营复核`
                  : `产品经理确认无误，最终评分 ${finalScore}，结论 ${finalConclusion}`
              ),
            ],
            updatedAt: now,
          };
        }),
      };
      break;
    }

    case 'PM_REJECT': {
      const { recordId, operator, reason } = action.payload;
      const now = new Date().toISOString();
      newState = {
        ...state,
        reviewRecords: state.reviewRecords.map(r => {
          if (r.recordId !== recordId) return r;
          return {
            ...r,
            status: 'pm_rejected',
            history: [
              ...r.history,
              createHistoryRecord(
                recordId,
                r.sampleId,
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
      const { recordId, operator } = action.payload;
      const now = new Date().toISOString();
      newState = {
        ...state,
        reviewRecords: state.reviewRecords.map(r => {
          if (r.recordId !== recordId) return r;
          return {
            ...r,
            status: 'operation_approved',
            finalScore: r.correction?.humanScore ?? r.interview.aiScore,
            finalConclusion: r.correction?.conclusion ?? (r.interview.aiScore >= 60 ? '通过' : '不通过'),
            history: [
              ...r.history,
              createHistoryRecord(
                recordId,
                r.sampleId,
                '运营复核通过',
                operator,
                'operation_reviewer',
                { status: r.status },
                { status: 'operation_approved', finalScore: r.correction?.humanScore, modelVersion: r.interview.modelVersion },
                `模型版本 ${r.interview.modelVersion} 复核通过，最终评分 ${r.correction?.humanScore ?? r.interview.aiScore}`
              ),
            ],
            updatedAt: now,
          };
        }),
      };
      break;
    }

    case 'OPERATION_REJECT': {
      const { recordId, operator, reason } = action.payload;
      const now = new Date().toISOString();
      newState = {
        ...state,
        reviewRecords: state.reviewRecords.map(r => {
          if (r.recordId !== recordId) return r;
          return {
            ...r,
            status: 'operation_rejected',
            history: [
              ...r.history,
              createHistoryRecord(
                recordId,
                r.sampleId,
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
      const { recordId, operator } = action.payload;
      const now = new Date().toISOString();
      newState = {
        ...state,
        reviewRecords: state.reviewRecords.map(r => {
          if (r.recordId !== recordId) return r;
          const finalScore = r.finalScore ?? r.correction?.humanScore ?? r.interview.aiScore;
          const finalConclusion = r.finalConclusion ?? r.correction?.conclusion ?? (r.interview.aiScore >= 60 ? '通过' : '不通过');
          return {
            ...r,
            status: 'finalized',
            finalScore,
            finalConclusion,
            history: [
              ...r.history,
              createHistoryRecord(
                recordId,
                r.sampleId,
                '归档',
                operator,
                state.currentRole,
                { status: r.status },
                { status: 'finalized', finalScore, finalConclusion },
                `记录已归档。样本编号 ${r.sampleId}，模型版本 ${r.interview.modelVersion}，最终评分 ${finalScore}，结论 ${finalConclusion}`
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
