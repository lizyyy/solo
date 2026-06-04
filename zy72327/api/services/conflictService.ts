import { ParameterRecord, ExampleRecord, Conflict } from '../../shared/types';
import { parseNumericValue } from './exponentialSmoothing';

function detectConflicts(
  paramRecords: ParameterRecord[],
  exampleRecords: ExampleRecord[],
  threshold: number = 5
): Conflict[] {
  const conflicts: Conflict[] = [];
  const exampleMap = new Map(exampleRecords.map(e => [e.productId, e]));

  for (const paramRecord of paramRecords) {
    const exampleRecord = exampleMap.get(paramRecord.productId);
    if (!exampleRecord) continue;

    const parameterValue = parseNumericValue(paramRecord.forecastConclusion);
    const exampleValue = exampleRecord.manualCalculation;

    const diffPercentage = exampleValue === 0
      ? (parameterValue === 0 ? 0 : 100)
      : Math.abs((parameterValue - exampleValue) / exampleValue) * 100;

    if (diffPercentage > threshold) {
      const evidence = `参数值: ${parameterValue}, 手算值: ${exampleValue}, 差异: ${diffPercentage.toFixed(2)}%, 手算理由: ${exampleRecord.reasoning}`;
      conflicts.push({
        id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        parameterRecordId: paramRecord.id,
        exampleRecordId: exampleRecord.id,
        productId: paramRecord.productId,
        productName: paramRecord.productName,
        parameterValue,
        exampleValue,
        diffPercentage,
        evidence,
        status: 'pending',
        resolution: null,
        resolutionReason: null,
        resolvedBy: null,
        resolvedAt: null,
      });
    }
  }

  return conflicts;
}

function resolveConflict(
  conflict: Conflict,
  resolution: 'accept_example' | 'reject_example',
  reason: string,
  resolvedBy: string
): Conflict {
  return {
    ...conflict,
    status: 'resolved',
    resolution,
    resolutionReason: reason,
    resolvedBy,
    resolvedAt: new Date().toISOString(),
  };
}

export { detectConflicts, resolveConflict };
