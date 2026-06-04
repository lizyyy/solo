import {
  SurveyRawRow,
  BoundaryNote,
  FilterResult,
  FilterConfig,
  EvidenceType,
  FilterRun,
} from '../types';
import {
  calculateMutualInfoForRow,
  evaluateBoundaryCondition,
  calculateCorrelationScore,
} from './mutualInfo';
import { store } from '../store';

export interface FilterResultWithReason {
  result: Omit<FilterResult, 'id'>;
  reason: string;
}

export function determineStatus(
  score: number,
  threshold: number,
  isAtThreshold: boolean,
  config: FilterConfig,
  hasFieldEvidence: boolean
): { status: FilterResult['status']; decisionReason: string } {
  if (isAtThreshold && config.requireReviewAtThreshold) {
    return {
      status: 'pending_review',
      decisionReason: `互信息得分(${score.toFixed(4)})恰好等于阈值(${threshold})，按规则留给任课老师复核，不自动归类`,
    };
  }

  if (score >= threshold) {
    if (hasFieldEvidence) {
      return {
        status: 'anomaly',
        decisionReason: `互信息得分(${score.toFixed(4)}) >= 阈值(${threshold})，且有边界值说明佐证，标记为异常`,
      };
    }
    return {
      status: 'anomaly',
      decisionReason: `互信息得分(${score.toFixed(4)}) >= 阈值(${threshold})，标记为异常（暂缺边界值说明佐证）`,
    };
  }

  if (score < threshold * 0.7) {
    return {
      status: 'normal',
      decisionReason: `互信息得分(${score.toFixed(4)}) 远低于阈值(${threshold})，判定为正常`,
    };
  }

  return {
    status: 'pending_review',
    decisionReason: `互信息得分(${score.toFixed(4)}) 接近阈值(${threshold})，需人工复核`,
  };
}

export function determineEvidenceType(
  row: SurveyRawRow,
  notes: BoundaryNote[]
): EvidenceType {
  const hasMainProcess = !!row.mainProcess && row.mainProcess.trim().length > 0;
  const hasFieldStatement = notes.some(
    n => n.questionId === row.questionId &&
      (!n.respondentId || n.respondentId === row.respondentId)
  );

  if (hasMainProcess && hasFieldStatement) {
    return 'both';
  }
  if (hasMainProcess) {
    return 'main_process';
  }
  return 'field_statement';
}

export function gatherEvidence(
  row: SurveyRawRow,
  notes: BoundaryNote[]
): {
  evidenceType: EvidenceType;
  mainProcessEvidence: string;
  fieldStatementEvidence?: string;
  matchingNotes: BoundaryNote[];
} {
  const matchingNotes = notes.filter(
    n => n.questionId === row.questionId &&
      (!n.respondentId || n.respondentId === row.respondentId)
  );

  const evidenceType = determineEvidenceType(row, notes);

  let fieldStatementEvidence: string | undefined;
  if (matchingNotes.length > 0) {
    fieldStatementEvidence = matchingNotes
      .map(n => `[${n.notedBy} ${n.notedAt}] ${n.fieldStatement} (阈值:${n.threshold} ${n.operator})${n.supplementary ? ` 补充:${n.supplementary}` : ''}`)
      .join(' | ');
  }

  return {
    evidenceType,
    mainProcessEvidence: row.mainProcess || '未填写主流程说明',
    fieldStatementEvidence,
    matchingNotes,
  };
}

export function processRow(
  row: SurveyRawRow,
  allRows: SurveyRawRow[],
  boundaryNotes: BoundaryNote[],
  config: FilterConfig
): FilterResultWithReason {
  const miResult = calculateMutualInfoForRow(row, allRows, boundaryNotes);
  const evidence = gatherEvidence(row, boundaryNotes);
  const correlationScore = calculateCorrelationScore(row, boundaryNotes);

  const adjustedScore = miResult.score * 0.6 + correlationScore * 0.4;
  const finalScore = Math.round(adjustedScore * 10000) / 10000;

  const { status, decisionReason } = determineStatus(
    finalScore,
    miResult.threshold,
    miResult.isAtThreshold,
    config,
    evidence.matchingNotes.length > 0
  );

  const now = new Date().toISOString();

  const result: Omit<FilterResult, 'id'> = {
    questionId: row.questionId,
    respondentId: row.respondentId,
    respondentName: row.respondentName,
    questionText: row.questionText,
    answer: row.answer,
    answerValue: row.answerValue,
    mutualInfoScore: finalScore,
    threshold: miResult.threshold,
    isAtThreshold: miResult.isAtThreshold,
    evidenceType: evidence.evidenceType,
    mainProcessEvidence: evidence.mainProcessEvidence,
    fieldStatementEvidence: evidence.fieldStatementEvidence,
    status,
    createdAt: now,
    updatedAt: now,
  };

  return {
    result,
    reason: decisionReason,
  };
}

export interface RunFilterOptions {
  triggeredBy: string;
  configOverrides?: Partial<FilterConfig>;
  surveyRowIds?: string[];
  boundaryNoteIds?: string[];
  existingRunId?: string;
}

export interface RunFilterResult {
  run: FilterRun;
  results: FilterResult[];
  summary: {
    total: number;
    normal: number;
    pendingReview: number;
    anomaly: number;
    withBothEvidence: number;
    withMainProcessOnly: number;
    withFieldStatementOnly: number;
    atThreshold: number;
  };
}

export function runFilter(options: RunFilterOptions): RunFilterResult {
  const baseConfig = store.getConfig();
  const config: FilterConfig = { ...baseConfig, ...options.configOverrides };

  const allRows = store.getSurveyRows();
  const allNotes = store.getBoundaryNotes();

  const rowsToProcess = options.surveyRowIds
    ? allRows.filter(r => options.surveyRowIds!.includes(r.id))
    : allRows;

  const notesToUse = options.boundaryNoteIds
    ? allNotes.filter(n => options.boundaryNoteIds!.includes(n.id))
    : allNotes;

  const now = new Date().toISOString();
  const run: FilterRun = store.addFilterRun({
    startedAt: now,
    status: 'running',
    triggeredBy: options.triggeredBy,
    config,
    surveyRowIds: rowsToProcess.map(r => r.id),
    boundaryNoteIds: notesToUse.map(n => n.id),
    resultCount: 0,
    anomalyCount: 0,
    pendingCount: 0,
  });

  const results: FilterResult[] = [];
  let normalCount = 0;
  let pendingCount = 0;
  let anomalyCount = 0;
  let withBothEvidence = 0;
  let withMainProcessOnly = 0;
  let withFieldStatementOnly = 0;
  let atThresholdCount = 0;

  for (const row of rowsToProcess) {
    const { result, reason } = processRow(row, rowsToProcess, notesToUse, config);

    const savedResult = store.addFilterResult(result);
    results.push(savedResult);

    switch (result.status) {
      case 'normal':
        normalCount++;
        break;
      case 'pending_review':
        pendingCount++;
        break;
      case 'anomaly':
        anomalyCount++;
        break;
    }

    switch (result.evidenceType) {
      case 'both':
        withBothEvidence++;
        break;
      case 'main_process':
        withMainProcessOnly++;
        break;
      case 'field_statement':
        withFieldStatementOnly++;
        break;
    }

    if (result.isAtThreshold) {
      atThresholdCount++;
    }

    store.addAuditLog({
      entityType: 'filter_result',
      entityId: savedResult.id,
      action: 'create',
      actor: options.triggeredBy,
      actorRole: 'assistant',
      changeDescription: `生成筛选结果 - ${reason}`,
      newValue: {
        ...savedResult,
        runId: run.id,
      } as unknown as Record<string, unknown>,
      reason: `互信息筛选运行 #${run.id.slice(0, 8)}`,
      timestamp: new Date().toISOString(),
    });
  }

  const completedAt = new Date().toISOString();
  const finalRun = store.updateFilterRun(run.id, {
    status: 'completed',
    completedAt,
    resultCount: results.length,
    anomalyCount,
    pendingCount,
  })!;

  return {
    run: finalRun,
    results,
    summary: {
      total: results.length,
      normal: normalCount,
      pendingReview: pendingCount,
      anomaly: anomalyCount,
      withBothEvidence,
      withMainProcessOnly,
      withFieldStatementOnly,
      atThreshold: atThresholdCount,
    },
  };
}

export function reRunFilter(
  runId: string,
  options: Omit<RunFilterOptions, 'existingRunId'>
): RunFilterResult {
  const existingRun = store.getFilterRunById(runId);
  if (!existingRun) {
    throw new Error(`Filter run ${runId} not found`);
  }

  const affectedResultIds = store.getFilterResults()
    .filter(r => {
      const logs = store.getAuditLogsByEntity('filter_result', r.id);
      return logs.some(l => l.reason?.includes(runId));
    })
    .map(r => r.id);

  const result = runFilter({
    ...options,
    surveyRowIds: existingRun.surveyRowIds,
  });

  store.addAuditLog({
    entityType: 'filter_run',
    entityId: runId,
    action: 're_run',
    actor: options.triggeredBy,
    actorRole: 'assistant',
    changeDescription: `重新运行筛选，新运行ID: ${result.run.id}`,
    oldValue: { id: runId } as unknown as Record<string, unknown>,
    newValue: { newRunId: result.run.id } as unknown as Record<string, unknown>,
    impactResults: affectedResultIds,
    reason: options.triggeredBy === '小穆' ? '实验助理小穆补充边界值说明后重跑' : '手动触发重跑',
    timestamp: new Date().toISOString(),
  });

  return result;
}

export function decideResult(
  resultId: string,
  decision: 'approve_normal' | 'approve_anomaly' | 'escalate',
  decidedBy: string,
  decisionNote: string
): FilterResult | undefined {
  const result = store.getFilterResultById(resultId);
  if (!result) return undefined;

  const oldValue = { ...result } as unknown as Record<string, unknown>;

  let newStatus: FilterResult['status'];
  let actionDescription: string;

  switch (decision) {
    case 'approve_normal':
      newStatus = 'normal';
      actionDescription = `${decidedBy} 复核后判定为正常`;
      break;
    case 'approve_anomaly':
      newStatus = 'anomaly';
      actionDescription = `${decidedBy} 复核后判定为异常`;
      break;
    case 'escalate':
      newStatus = 'pending_review';
      actionDescription = `${decidedBy} 转交给更高权限复核`;
      break;
  }

  const updated = store.updateFilterResult(resultId, {
    status: newStatus,
    decidedBy,
    decidedAt: new Date().toISOString(),
    decisionNote: `${actionDescription}。备注: ${decisionNote}`,
  });

  if (updated) {
    store.addAuditLog({
      entityType: 'filter_result',
      entityId: resultId,
      action: 'decide',
      actor: decidedBy,
      actorRole: decidedBy === '小穆' ? 'assistant' : 'teacher',
      changeDescription: actionDescription,
      oldValue,
      newValue: { status: newStatus, decisionNote } as unknown as Record<string, unknown>,
      reason: decisionNote,
      timestamp: new Date().toISOString(),
    });
  }

  return updated;
}

export function getResultsAffectedByNote(noteId: string): FilterResult[] {
  const note = store.getBoundaryNoteById(noteId);
  if (!note) return [];

  return store.getFilterResults().filter(
    r => r.questionId === note.questionId &&
      (!note.respondentId || r.respondentId === note.respondentId)
  );
}
