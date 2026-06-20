import type {
  CalculationRun,
  AnomalyRecord,
  ComparisonResult,
  ChangedRecord,
  ChangeReason,
  CalculationParams,
} from '@/types';

export function compareRuns(runA: CalculationRun, runB: CalculationRun): ComparisonResult {
  const anomaliesAByAnswer = new Map<string, AnomalyRecord>();
  const anomaliesBByAnswer = new Map<string, AnomalyRecord>();

  runA.anomalies.forEach(a => anomaliesAByAnswer.set(a.answerId, a));
  runB.anomalies.forEach(a => anomaliesBByAnswer.set(a.answerId, a));

  const allAnswerIds = new Set<string>([
    ...anomaliesAByAnswer.keys(),
    ...anomaliesBByAnswer.keys(),
  ]);

  const changedRecords: ChangedRecord[] = [];

  for (const answerId of allAnswerIds) {
    const anomalyA = anomaliesAByAnswer.get(answerId);
    const anomalyB = anomaliesBByAnswer.get(answerId);

    if (!anomalyA && anomalyB) {
      changedRecords.push({
        answerId,
        anomalyB,
        changeType: 'added',
        reasons: inferReasons(runA.params, runB.params),
      });
    } else if (anomalyA && !anomalyB) {
      changedRecords.push({
        answerId,
        anomalyA,
        changeType: 'removed',
        reasons: inferReasons(runA.params, runB.params),
      });
    } else if (anomalyA && anomalyB) {
      if (anomalyA.type !== anomalyB.type) {
        changedRecords.push({
          answerId,
          anomalyA,
          anomalyB,
          changeType: 'type_changed',
          reasons: inferReasons(runA.params, runB.params),
        });
      } else if (anomalyA.status !== anomalyB.status) {
        changedRecords.push({
          answerId,
          anomalyA,
          anomalyB,
          changeType: 'status_changed',
          reasons: ['parameter'],
        });
      } else {
        const valueA = anomalyA.calculation.value;
        const valueB = anomalyB.calculation.value;
        const hasValueChange = valueA !== valueB && (valueA !== null || valueB !== null);

        if (hasValueChange) {
          const delta = valueA !== null && valueB !== null ? valueB - valueA : null;
          changedRecords.push({
            answerId,
            anomalyA,
            anomalyB,
            changeType: 'value_changed',
            valueChange: {
              oldValue: valueA,
              newValue: valueB,
              delta,
            },
            reasons: inferReasons(runA.params, runB.params, anomalyA, anomalyB),
          });
        }
      }
    }
  }

  const summary = buildSummary(changedRecords);

  return {
    runA,
    runB,
    changedRecords,
    summary,
  };
}

function inferReasons(
  paramsA: CalculationParams,
  paramsB: CalculationParams,
  anomalyA?: AnomalyRecord,
  anomalyB?: AnomalyRecord,
): ChangeReason[] {
  const reasons: ChangeReason[] = [];

  if (paramsA.formula !== paramsB.formula) {
    reasons.push('formula');
  }

  if (
    JSON.stringify(paramsA.boundaryConfig) !== JSON.stringify(paramsB.boundaryConfig) ||
    paramsA.tolerance !== paramsB.tolerance
  ) {
    reasons.push('parameter');
  }

  if (JSON.stringify(paramsA.unitConfig) !== JSON.stringify(paramsB.unitConfig)) {
    reasons.push('unit');
  }

  if (
    anomalyA && anomalyB &&
    (anomalyA.isBoundary || anomalyB.isBoundary) &&
    (anomalyA.isBoundary !== anomalyB.isBoundary ||
      anomalyA.boundaryReason !== anomalyB.boundaryReason)
  ) {
    reasons.push('boundary');
  }

  if (
    anomalyA && anomalyB &&
    (anomalyA.type === 'bad_data' || anomalyB.type === 'bad_data') &&
    anomalyA.type !== anomalyB.type
  ) {
    reasons.push('data_quality');
  }

  if (reasons.length === 0) {
    reasons.push('parameter');
  }

  return reasons;
}

function buildSummary(changedRecords: ChangedRecord[]) {
  const summary = {
    totalChanged: changedRecords.length,
    byReason: {
      formula: 0,
      parameter: 0,
      unit: 0,
      boundary: 0,
      data_quality: 0,
    } as Record<ChangeReason, number>,
    addedCount: 0,
    removedCount: 0,
    typeChangedCount: 0,
    valueChangedCount: 0,
  };

  for (const record of changedRecords) {
    switch (record.changeType) {
      case 'added':
        summary.addedCount++;
        break;
      case 'removed':
        summary.removedCount++;
        break;
      case 'type_changed':
        summary.typeChangedCount++;
        break;
      case 'value_changed':
        summary.valueChangedCount++;
        break;
    }

    const uniqueReasons = new Set(record.reasons);
    for (const reason of uniqueReasons) {
      summary.byReason[reason]++;
    }
  }

  return summary;
}

export const CHANGE_REASON_LABELS: Record<ChangeReason, string> = {
  formula: '公式变化',
  parameter: '参数变化',
  unit: '单位口径变化',
  boundary: '边界样本影响',
  data_quality: '数据质量',
};
