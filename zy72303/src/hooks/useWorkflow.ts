import { useAppContext } from '../store/AppContext';
import { dijkstra, findAlternativePath, calculateDetourRatio } from '../utils/graphAlgorithms';
import { createComparisonResult, generateClassroomNote } from '../utils/dataUtils';
import type { WorkflowStage, Stakeholder } from '../types';

export function useWorkflow() {
  const { state, dispatch } = useAppContext();

  const workflowStages: { id: WorkflowStage; name: string; description: string }[] = [
    {
      id: 'initial_import',
      name: '第一步：参数首次导入',
      description: '导入参数调试表，系统自动去重、标记分母为0的异常记录',
    },
    {
      id: 'alan_review',
      name: '第二步：阿岚补看手算反例',
      description: '运营规划阿岚检查异常记录，补充手算反例和备注说明',
    },
    {
      id: 'classroom_demo',
      name: '第三步：课堂演示结果更新',
      description: '生成可解释的绕行比较报告，添加课堂演示说明',
    },
  ];

  function advanceStage() {
    dispatch({ type: 'ADVANCE_WORKFLOW_STAGE' });
  }

  function setStage(stage: WorkflowStage) {
    dispatch({ type: 'SET_WORKFLOW_STAGE', payload: stage });
  }

  function runComparison() {
    const currentParamVersion = state.parameterVersions.find(
      v => v.version === state.currentParameterVersion
    );
    if (!currentParamVersion) return;

    const recordsToProcess = state.parameterRecords.filter(record => {
      const existingResult = state.comparisonResults.find(
        r => r.parameterRecordId === record.id
      );
      return !existingResult;
    });

    recordsToProcess.forEach(record => {
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

      dispatch({ type: 'ADD_COMPARISON_RESULT', payload: result });
    });
  }

  function provideCounterexample(recordId: string, counterexample: string, author: Stakeholder) {
    dispatch({
      type: 'PROVIDE_COUNTEREXAMPLE',
      payload: { recordId, counterexample, author },
    });
  }

  function approveRecord(recordId: string, reviewer: Stakeholder, comment?: string) {
    dispatch({
      type: 'APPROVE_RECORD',
      payload: { recordId, reviewer, comment },
    });
  }

  function rejectRecord(recordId: string, reviewer: Stakeholder, comment?: string) {
    dispatch({
      type: 'REJECT_RECORD',
      payload: { recordId, reviewer, comment },
    });
  }

  function updateClassroomNote(resultId: string, note: string) {
    dispatch({
      type: 'UPDATE_CLASSROOM_NOTE',
      payload: { resultId, note },
    });
  }

  function markDemoUpdated(resultId: string) {
    dispatch({
      type: 'MARK_DEMO_UPDATED',
      payload: { resultId },
    });
  }

  function autoGenerateClassroomNotes() {
    state.comparisonResults.forEach(result => {
      const record = state.parameterRecords.find(
        r => r.id === result.parameterRecordId
      );
      if (record && !result.classroomNote) {
        const note = generateClassroomNote(result, record);
        dispatch({
          type: 'UPDATE_CLASSROOM_NOTE',
          payload: { resultId: result.id, note },
        });
      }
    });
  }

  function getStageProgress(stage: WorkflowStage): number {
    switch (stage) {
      case 'initial_import':
        return state.parameterRecords.length > 0 ? 100 : 0;
      case 'alan_review': {
        const zeroDenomRecords = state.parameterRecords.filter(
          r => r.status === 'zero_denominator'
        );
        if (zeroDenomRecords.length === 0) return 100;
        const withCounterexample = zeroDenomRecords.filter(
          r => r.manualCounterexample
        );
        return Math.round((withCounterexample.length / zeroDenomRecords.length) * 100);
      }
      case 'classroom_demo': {
        if (state.comparisonResults.length === 0) return 0;
        const withNotes = state.comparisonResults.filter(r => r.classroomNote);
        return Math.round((withNotes.length / state.comparisonResults.length) * 100);
      }
      default:
        return 0;
    }
  }

  return {
    workflowStages,
    currentStage: state.workflowStage,
    advanceStage,
    setStage,
    runComparison,
    provideCounterexample,
    approveRecord,
    rejectRecord,
    updateClassroomNote,
    markDemoUpdated,
    autoGenerateClassroomNotes,
    getStageProgress,
  };
}
