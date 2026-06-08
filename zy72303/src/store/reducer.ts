import type { AppState, AppAction, WorkflowStage, RecordStatus, ParameterRecord, DetourComparisonResult } from '../types';
import {
  createParameterRecordVersion,
  deduplicateRecords,
  generateExplanation,
  createComparisonResult,
  generateClassroomNote,
} from '../utils/dataUtils';
import {
  dijkstra,
  findAlternativePath,
  calculateDetourRatio,
} from '../utils/graphAlgorithms';

function recalcOneExplanation(
  result: DetourComparisonResult,
  record: ParameterRecord | undefined,
  state: AppState
): DetourComparisonResult {
  if (!record) return result;
  const paramVersion = state.parameterVersions.find(
    v => v.version === state.currentParameterVersion
  ) || result.parameterVersion;
  const explanation = generateExplanation(
    record,
    result.shortestPath,
    result.alternativePath,
    result.detourRatio,
    paramVersion.parameters,
    state.graph.nodes
  );
  const isSig =
    result.detourRatio !== null &&
    result.detourRatio >= paramVersion.parameters.detourThreshold;
  return {
    ...result,
    explanation,
    parameterVersion: paramVersion,
    thresholdUsed: paramVersion.parameters.detourThreshold,
    isSignificantDetour: isSig,
    status: record.status,
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'IMPORT_PARAMETER_RECORDS': {
      const dedup = deduplicateRecords(
        action.payload,
        state.parameterRecords
      );
      return {
        ...state,
        parameterRecords: [...state.parameterRecords, ...dedup.records],
        lastImportStats: {
          importedCount: dedup.records.length,
          duplicateCount: dedup.duplicatesCount,
          skippedCount: dedup.skippedCount,
          timestamp: Date.now(),
        },
        workflowStage:
          state.parameterRecords.length === 0 && dedup.records.length > 0
            ? 'initial_import'
            : state.workflowStage,
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

    case 'RESET_ALL_DATA': {
      return {
        ...state,
        parameterRecords: [],
        comparisonResults: [],
        reviewTasks: [],
        selectedRecordId: null,
        selectedResultId: null,
        workflowStage: 'initial_import',
        lastImportStats: undefined,
        flowMessage: undefined,
        showHistoryDiff: false,
      };
    }

    case 'SET_IMPORT_STATS': {
      return {
        ...state,
        lastImportStats: {
          ...action.payload,
          timestamp: Date.now(),
        },
      };
    }

    case 'SET_FLOW_MESSAGE': {
      if (action.payload === null) {
        return { ...state, flowMessage: undefined };
      }
      return {
        ...state,
        flowMessage: {
          ...action.payload,
          timestamp: Date.now(),
        },
      };
    }

    case 'UPDATE_PARAMETER_RECORD': {
      const { id, changes, author, description } = action.payload;
      let updatedState: AppState = {
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
      const relatedRecord = updatedState.parameterRecords.find(r => r.id === id);
      if (relatedRecord) {
        updatedState = {
          ...updatedState,
          comparisonResults: updatedState.comparisonResults.map(result =>
            result.parameterRecordId === id
              ? recalcOneExplanation(result, relatedRecord, updatedState)
              : result
          ),
        };
      }
      return updatedState;
    }

    case 'PROVIDE_COUNTEREXAMPLE': {
      const { recordId, counterexample, author } = action.payload;
      const now = Date.now();
      let updatedState: AppState = {
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
      const relatedRecord = updatedState.parameterRecords.find(r => r.id === recordId);
      if (relatedRecord) {
        updatedState = {
          ...updatedState,
          comparisonResults: updatedState.comparisonResults.map(result =>
            result.parameterRecordId === recordId
              ? recalcOneExplanation(result, relatedRecord, updatedState)
              : result
          ),
        };
      }
      return updatedState;
    }

    case 'APPROVE_RECORD': {
      const { recordId, reviewer, comment } = action.payload;
      const now = Date.now();
      let updatedState: AppState = {
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
      const relatedRecord = updatedState.parameterRecords.find(r => r.id === recordId);
      if (relatedRecord) {
        updatedState = {
          ...updatedState,
          comparisonResults: updatedState.comparisonResults.map(result =>
            result.parameterRecordId === recordId
              ? recalcOneExplanation(result, relatedRecord, updatedState)
              : result
          ),
        };
      }
      return updatedState;
    }

    case 'REJECT_RECORD': {
      const { recordId, reviewer, comment } = action.payload;
      const now = Date.now();
      let updatedState: AppState = {
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
      const relatedRecord = updatedState.parameterRecords.find(r => r.id === recordId);
      if (relatedRecord) {
        updatedState = {
          ...updatedState,
          comparisonResults: updatedState.comparisonResults.map(result =>
            result.parameterRecordId === recordId
              ? recalcOneExplanation(result, relatedRecord, updatedState)
              : result
          ),
        };
      }
      return updatedState;
    }

    case 'RUN_COMPARISON': {
      const currentParamVersion = state.parameterVersions.find(
        v => v.version === state.currentParameterVersion
      );
      if (!currentParamVersion) return state;
      const newResults: DetourComparisonResult[] = [];
      state.parameterRecords.forEach(record => {
        const existingResult = state.comparisonResults.find(
          r => r.parameterRecordId === record.id
        );
        if (existingResult) return;
        const shortestPath = dijkstra(
          state.graph.nodes,
          state.graph.edges,
          record.sourceNode,
          record.targetNode,
          currentParamVersion.parameters.maxPathLength
        );
        if (!shortestPath) return;
        const alternativePath = findAlternativePath(
          state.graph.nodes,
          state.graph.edges,
          record.sourceNode,
          record.targetNode,
          shortestPath.edges,
          currentParamVersion.parameters.maxPathLength + 2
        );
        if (!alternativePath) return;
        const detourRatio = calculateDetourRatio(shortestPath, alternativePath);
        const result = createComparisonResult(
          record,
          shortestPath,
          alternativePath,
          detourRatio,
          currentParamVersion,
          state.graph.nodes
        );
        newResults.push(result);
      });
      if (newResults.length === 0) return state;
      return {
        ...state,
        comparisonResults: [...state.comparisonResults, ...newResults],
      };
    }

    case 'RECALCULATE_EXPLANATIONS': {
      return {
        ...state,
        comparisonResults: state.comparisonResults.map(result => {
          const record = state.parameterRecords.find(
            r => r.id === result.parameterRecordId
          );
          return recalcOneExplanation(result, record, state);
        }),
      };
    }

    case 'REMOVE_COMPARISON_RESULTS_BY_RECORD': {
      return {
        ...state,
        comparisonResults: state.comparisonResults.filter(
          r => r.parameterRecordId !== action.payload
        ),
      };
    }

    case 'FLOW_STEP4_ADD_COUNTEREXAMPLE': {
      const zeroRecords = state.parameterRecords.filter(r => r.status === 'zero_denominator');
      const target = zeroRecords[1] || zeroRecords[0];
      if (!target) return state;
      const now = Date.now();
      const counterexample = `【手算验证】${target.sourceNode}→${target.targetNode}：分母为0系统计区间为空导致，实际值参考相邻小时数据（取24），绕行率约1.17，在阈值1.25以内，可用于课堂演示说明分母为0的处理流程。`;
      const changes = {
        manualCounterexample: counterexample,
        counterexampleProvider: 'alan' as const,
        counterexampleTimestamp: now,
        status: 'counterexample_provided' as const,
      };
      let updatedState: AppState = {
        ...state,
        currentUser: 'alan',
        selectedRecordId: target.id,
        parameterRecords: state.parameterRecords.map(record => {
          if (record.id !== target.id) return record;
          const newVersion = createParameterRecordVersion(record, changes, 'alan', '补充手算反例');
          return { ...record, ...changes, versions: [...record.versions, newVersion], currentVersion: newVersion.version };
        }),
      };
      const related = updatedState.parameterRecords.find(r => r.id === target.id);
      if (related) {
        updatedState = {
          ...updatedState,
          comparisonResults: updatedState.comparisonResults.map(result =>
            result.parameterRecordId === target.id ? recalcOneExplanation(result, related, updatedState) : result
          ),
        };
      }
      return updatedState;
    }

    case 'FLOW_STEP5_UPDATE_REMARK': {
      const bgRec = state.parameterRecords.find(
        r => r.sourceNode === 'B' && r.targetNode === 'G'
      );
      if (!bgRec) return state;
      const newRemark = '早高峰临时封路（已补手算反例，待数据复核人确认）';
      const desc = `备注："${bgRec.remark}"→"${newRemark}"`;
      const changes = { remark: newRemark };
      let updatedState: AppState = {
        ...state,
        currentUser: 'alan',
        selectedRecordId: bgRec.id,
        parameterRecords: state.parameterRecords.map(record => {
          if (record.id !== bgRec.id) return record;
          const newVersion = createParameterRecordVersion(record, changes, 'alan', desc);
          return { ...record, ...changes, versions: [...record.versions, newVersion], currentVersion: newVersion.version };
        }),
      };
      const related = updatedState.parameterRecords.find(r => r.id === bgRec.id);
      if (related) {
        updatedState = {
          ...updatedState,
          comparisonResults: updatedState.comparisonResults.map(result =>
            result.parameterRecordId === bgRec.id ? recalcOneExplanation(result, related, updatedState) : result
          ),
        };
      }
      return updatedState;
    }

    case 'FLOW_STEP6_APPROVE_ALL': {
      const now = Date.now();
      let updatedState: AppState = { ...state, currentUser: 'data_reviewer' };
      state.parameterRecords.forEach(rec => {
        if (rec.reviewStatus === 'approved') return;
        const comment = `数据复核通过：${rec.status === 'zero_denominator' || rec.status === 'counterexample_provided' ? '分母为0保留为异常，用于演示' : '路线绕行判断合理'}`;
        const changes: Partial<Pick<ParameterRecord, 'reviewStatus' | 'status'>> = {
          reviewStatus: 'approved',
          status: ((rec.status === 'zero_denominator' || rec.status === 'counterexample_provided')
            ? 'zero_denominator' : 'demo_ready') as RecordStatus,
        };
        updatedState = {
          ...updatedState,
          parameterRecords: updatedState.parameterRecords.map(record => {
            if (record.id !== rec.id) return record;
            const newVersion = createParameterRecordVersion(record, changes, 'data_reviewer', comment);
            return { ...record, ...changes, versions: [...record.versions, newVersion], currentVersion: newVersion.version };
          }),
          reviewTasks: updatedState.reviewTasks.map(task =>
            task.parameterRecordId === rec.id
              ? { ...task, status: 'approved' as const, completedAt: now, comment }
              : task
          ),
        };
        const related = updatedState.parameterRecords.find(r => r.id === rec.id);
        if (related) {
          updatedState = {
            ...updatedState,
            comparisonResults: updatedState.comparisonResults.map(result =>
              result.parameterRecordId === rec.id ? recalcOneExplanation(result, related, updatedState) : result
            ),
          };
        }
      });
      return updatedState;
    }

    case 'FLOW_STEP7_SYNC_NOTES': {
      let updatedState: AppState = { ...state };
      state.comparisonResults.forEach(result => {
        const record = state.parameterRecords.find(r => r.id === result.parameterRecordId);
        if (!record) return;
        const note = generateClassroomNote(result, record);
        updatedState = {
          ...updatedState,
          comparisonResults: updatedState.comparisonResults.map(r =>
            r.id === result.id ? { ...r, classroomNote: note, demoUpdated: true } : r
          ),
        };
      });
      return updatedState;
    }

    default:
      return state;
  }
}
