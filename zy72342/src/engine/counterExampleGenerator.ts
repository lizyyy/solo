import { FilterResult, BoundaryNote, CounterExample } from '../types';
import { store } from '../store';
import { getResultsAffectedByNote } from './filterEngine';

export interface CounterExampleAnalysis {
  reasonKept: string;
  missingMaterials: string[];
  nextAction: CounterExample['nextAction'];
  nextHandler: string;
}

export function analyzeCounterExample(
  result: FilterResult,
  boundaryNotes: BoundaryNote[],
  config = store.getConfig()
): CounterExampleAnalysis {
  const missingMaterials: string[] = [];
  let reasonKept = '';
  let nextAction: CounterExample['nextAction'] = 'contact_teacher';
  let nextHandler = config.defaultHandlerForPending;

  const hasMainProcessEvidence = !!result.mainProcessEvidence &&
    result.mainProcessEvidence !== '未填写主流程说明';
  const hasFieldEvidence = !!result.fieldStatementEvidence;

  if (result.isAtThreshold) {
    reasonKept = `互信息得分(${result.mutualInfoScore})恰好等于阈值(${result.threshold})，按规则必须留给任课老师复核，不自动判定`;
    nextAction = 'contact_teacher';
    nextHandler = config.defaultHandlerForPending;
    if (!hasFieldEvidence) {
      missingMaterials.push('该问题的边界值说明（现场说法）');
    }
    if (!hasMainProcessEvidence) {
      missingMaterials.push('问卷原始行中的主流程说明');
    }
    return { reasonKept, missingMaterials, nextAction, nextHandler };
  }

  if (result.status === 'pending_review') {
    if (!hasFieldEvidence && !hasMainProcessEvidence) {
      reasonKept = '问卷原始行缺主流程说明，边界值说明也没找到对应记录，两边证据都不足，无法自动判定';
      missingMaterials.push('问卷原始行中的主流程说明');
      missingMaterials.push('该问题的边界值说明（现场说法）');
      nextAction = 'contact_assistant';
      nextHandler = '小穆';
    } else if (!hasFieldEvidence) {
      reasonKept = '只有问卷主流程说明，缺少边界值说明（现场说法）的佐证，证据链不完整';
      missingMaterials.push('该问题的边界值说明（现场说法）');
      nextAction = 'contact_assistant';
      nextHandler = '小穆';
    } else if (!hasMainProcessEvidence) {
      reasonKept = '只有边界值说明（现场说法），问卷原始行缺主流程说明，证据链不完整';
      missingMaterials.push('问卷原始行中的主流程说明');
      nextAction = 'collect_more';
      nextHandler = '小穆';
    } else {
      const matchingNotes = boundaryNotes.filter(
        n => n.questionId === result.questionId &&
          (!n.respondentId || n.respondentId === result.respondentId)
      );
      if (matchingNotes.length > 0) {
        const noteWithSupplementary = matchingNotes.find(n => !n.supplementary);
        if (noteWithSupplementary) {
          reasonKept = `边界值说明「${matchingNotes[0].fieldStatement}」缺少补充说明，无法判断是否适用于此场景`;
          missingMaterials.push('边界值说明的补充说明（现场具体情况）');
          nextAction = 'contact_teacher';
          nextHandler = config.defaultHandlerForPending;
        } else {
          reasonKept = `互信息得分(${result.mutualInfoScore})接近阈值(${result.threshold})，虽然两边证据都有，但仍需人工确认`;
          nextAction = 'contact_teacher';
          nextHandler = config.defaultHandlerForPending;
        }
      } else {
        reasonKept = `互信息得分(${result.mutualInfoScore})接近阈值(${result.threshold})，需人工复核`;
        nextAction = 'contact_teacher';
        nextHandler = config.defaultHandlerForPending;
      }
    }
  } else if (result.status === 'anomaly') {
    if (!hasFieldEvidence) {
      reasonKept = `互信息得分(${result.mutualInfoScore}) >= 阈值(${result.threshold})，但只有问卷主流程说明，缺边界值说明（现场说法）佐证`;
      missingMaterials.push('该问题的边界值说明（现场说法）');
      nextAction = 'contact_assistant';
      nextHandler = '小穆';
    } else if (!hasMainProcessEvidence) {
      reasonKept = `互信息得分(${result.mutualInfoScore}) >= 阈值(${result.threshold})，但只有边界值说明，问卷原始行缺主流程说明`;
      missingMaterials.push('问卷原始行中的主流程说明');
      nextAction = 'collect_more';
      nextHandler = '小穆';
    } else {
      reasonKept = `互信息得分(${result.mutualInfoScore}) >= 阈值(${result.threshold})，且问卷主流程与边界值说明两边证据相互印证`;
      nextAction = 'contact_teacher';
      nextHandler = config.defaultHandlerForPending;
    }
  } else if (result.status === 'normal') {
    reasonKept = `互信息得分(${result.mutualInfoScore}) 远低于阈值(${result.threshold})，已判定为正常`;
    nextAction = 'resolved';
    nextHandler = '-';
  } else {
    reasonKept = '已处理完成';
    nextAction = 'resolved';
    nextHandler = '-';
  }

  return { reasonKept, missingMaterials, nextAction, nextHandler };
}

export function generateCounterExample(
  result: FilterResult,
  boundaryNotes: BoundaryNote[]
): Omit<CounterExample, 'id'> {
  const analysis = analyzeCounterExample(result, boundaryNotes);
  const now = new Date().toISOString();

  return {
    filterResultId: result.id,
    questionId: result.questionId,
    respondentId: result.respondentId,
    respondentName: result.respondentName,
    reasonKept: analysis.reasonKept,
    missingMaterials: analysis.missingMaterials,
    nextAction: analysis.nextAction,
    nextHandler: analysis.nextHandler,
    status: analysis.nextAction === 'resolved' ? 'resolved' : 'open',
    evidence: {
      mainProcess: result.mainProcessEvidence,
      fieldStatement: result.fieldStatementEvidence,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function generateCounterExamplesForRun(
  runId: string,
  results: FilterResult[]
): CounterExample[] {
  const boundaryNotes = store.getBoundaryNotes();
  const counterExamples: CounterExample[] = [];

  for (const result of results) {
    if (result.status !== 'normal' || result.isAtThreshold) {
      const counterExample = generateCounterExample(result, boundaryNotes);
      const saved = store.addCounterExample(counterExample);
      counterExamples.push(saved);

      store.addAuditLog({
        entityType: 'counter_example',
        entityId: saved.id,
        action: 'create',
        actor: 'system',
        actorRole: 'admin',
        changeDescription: `生成反例条目 - ${saved.nextAction === 'contact_teacher' ? '待任课老师处理' : saved.nextAction === 'contact_assistant' ? '待实验助理小穆处理' : '待补充材料'}`,
        newValue: saved as unknown as Record<string, unknown>,
        reason: `筛选运行 #${runId.slice(0, 8)} 生成反例`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return counterExamples;
}

function collectLatestEvidence(
  result: FilterResult,
  boundaryNotes: BoundaryNote[]
): { mainProcess?: string; fieldStatement?: string } {
  const matchingNotes = boundaryNotes.filter(
    n => n.questionId === result.questionId &&
      (!n.respondentId || n.respondentId === result.respondentId)
  );

  let fieldStatementEvidence: string | undefined;
  if (matchingNotes.length > 0) {
    fieldStatementEvidence = matchingNotes
      .map(n => `[${n.notedBy} ${n.notedAt}] ${n.fieldStatement} (阈值:${n.threshold} ${n.operator})${n.supplementary ? ` 补充:${n.supplementary}` : ''}`)
      .join(' | ');
  }

  return {
    mainProcess: result.mainProcessEvidence,
    fieldStatement: fieldStatementEvidence,
  };
}

export function regenerateCounterExamplesForNote(
  noteId: string,
  actor: string
): { updated: CounterExample[]; added: CounterExample[] } {
  const note = store.getBoundaryNoteById(noteId);
  if (!note) {
    return { updated: [], added: [] };
  }

  const affectedResults = getResultsAffectedByNote(noteId);
  const boundaryNotes = store.getBoundaryNotes();
  const allCounterExamples = store.getCounterExamples();

  const updated: CounterExample[] = [];
  const added: CounterExample[] = [];

  for (const result of affectedResults) {
    const existing = allCounterExamples.find(c => c.filterResultId === result.id);
    const newAnalysis = analyzeCounterExample(result, boundaryNotes);
    const latestEvidence = collectLatestEvidence(result, boundaryNotes);

    if (result.status === 'normal' && !result.isAtThreshold && !existing) {
      continue;
    }

    if (existing) {
      const oldValue = { ...existing } as unknown as Record<string, unknown>;
      const oldEvidenceStr = JSON.stringify(existing.evidence);
      const newEvidenceStr = JSON.stringify(latestEvidence);

      const hasChanges =
        existing.reasonKept !== newAnalysis.reasonKept ||
        JSON.stringify(existing.missingMaterials) !== JSON.stringify(newAnalysis.missingMaterials) ||
        existing.nextAction !== newAnalysis.nextAction ||
        existing.nextHandler !== newAnalysis.nextHandler ||
        oldEvidenceStr !== newEvidenceStr;

      if (hasChanges) {
        const updatedExample = store.updateCounterExample(existing.id, {
          reasonKept: newAnalysis.reasonKept,
          missingMaterials: newAnalysis.missingMaterials,
          nextAction: newAnalysis.nextAction,
          nextHandler: newAnalysis.nextHandler,
          status: newAnalysis.nextAction === 'resolved' ? 'resolved' : 'in_progress',
          evidence: latestEvidence,
        })!;

        updated.push(updatedExample);

        store.addAuditLog({
          entityType: 'counter_example',
          entityId: existing.id,
          action: 'update',
          actor,
          actorRole: actor === '小穆' ? 'assistant' : 'teacher',
          changeDescription: `补录边界值说明后更新反例：${existing.nextHandler} → ${newAnalysis.nextHandler}`,
          oldValue,
          newValue: updatedExample as unknown as Record<string, unknown>,
          impactResults: [result.id],
          reason: `补录边界值说明「${note.fieldStatement}」后反例列表自动更新`,
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      const resultWithUpdatedEvidence = {
        ...result,
        fieldStatementEvidence: latestEvidence.fieldStatement,
      };
      const newExample = generateCounterExample(resultWithUpdatedEvidence, boundaryNotes);
      const saved = store.addCounterExample(newExample);
      added.push(saved);

      store.addAuditLog({
        entityType: 'counter_example',
        entityId: saved.id,
        action: 'create',
        actor,
        actorRole: actor === '小穆' ? 'assistant' : 'teacher',
        changeDescription: `补录边界值说明后新增反例条目`,
        newValue: saved as unknown as Record<string, unknown>,
        impactResults: [result.id],
        reason: `补录边界值说明「${note.fieldStatement}」后新增反例`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return { updated, added };
}

export function updateCounterExampleStatus(
  counterExampleId: string,
  status: CounterExample['status'],
  actor: string,
  note: string
): CounterExample | undefined {
  const existing = store.getCounterExampleById(counterExampleId);
  if (!existing) return undefined;

  const oldValue = { ...existing } as unknown as Record<string, unknown>;
  const updated = store.updateCounterExample(counterExampleId, { status });

  if (updated) {
    store.addAuditLog({
      entityType: 'counter_example',
      entityId: counterExampleId,
      action: 'update',
      actor,
      actorRole: actor === '小穆' ? 'assistant' : 'teacher',
      changeDescription: `反例状态更新：${existing.status} → ${status}`,
      oldValue,
      newValue: { status } as unknown as Record<string, unknown>,
      impactResults: [existing.filterResultId],
      reason: note,
      timestamp: new Date().toISOString(),
    });
  }

  return updated;
}
