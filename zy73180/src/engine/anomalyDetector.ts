import type {
  HistoricalAnswer,
  AnomalyRecord,
  AnomalyType,
  CalculationRun,
  CalculationParams,
  FieldMapping,
} from '@/types';
import {
  calculateRecord,
  checkUnitCompleteness,
  isBoundarySample,
  isBadData,
  generateSuggestion,
} from './calculator';
import { applyMapping } from './fieldMapper';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function detectAnomalies(
  answers: HistoricalAnswer[],
  mappings: FieldMapping[],
  params: CalculationParams,
  runName: string
): CalculationRun {
  const anomalies: AnomalyRecord[] = [];
  const allValues: number[] = [];

  const mappingMap = new Map(mappings.map(m => [m.id, m]));

  const mappedDataList: { data: Record<string, any>; answer: HistoricalAnswer; index: number }[] = [];

  answers.forEach((answer, index) => {
    const mapping = mappingMap.get(answer.fieldMappingId);
    if (!mapping) return;

    const mapped = applyMapping(answer.rawData, mapping);
    mappedDataList.push({ data: mapped, answer, index });

    const badCheck = isBadData(mapped);
    if (!badCheck.isBad && mapped.value !== undefined && mapped.value !== null) {
      const numValue = Number(mapped.value);
      if (isFinite(numValue)) {
        allValues.push(numValue);
      }
    }
  });

  mappedDataList.forEach(({ data, answer, index }) => {
    const badCheck = isBadData(data);

    if (badCheck.isBad) {
      anomalies.push(createAnomalyRecord(
        'bad_data',
        answer,
        data,
        {
          value: null,
          unit: data.unit || null,
          formula: params.formula,
          variables: {},
          success: false,
          errorMessage: badCheck.reason,
        },
        index,
        badCheck.reason,
        undefined,
        undefined,
      ));
      return;
    }

    const unitCheck = checkUnitCompleteness(data, params.unitConfig.requiredFields);

    if (!unitCheck.complete) {
      const calcResult = calculateRecord(data, params);
      anomalies.push(createAnomalyRecord(
        'unit_missing',
        answer,
        data,
        calcResult,
        index,
        undefined,
        unitCheck.missingFields,
        undefined,
      ));
      return;
    }

    const calcResult = calculateRecord(data, params);

    if (!calcResult.success) {
      anomalies.push(createAnomalyRecord(
        'calculation_error',
        answer,
        data,
        calcResult,
        index,
        calcResult.errorMessage,
        undefined,
        undefined,
      ));
      return;
    }

    if (calcResult.value !== null) {
      const boundaryCheck = isBoundarySample(calcResult.value, allValues, params);
      if (boundaryCheck.isBoundary) {
        anomalies.push(createAnomalyRecord(
          'boundary_sample',
          answer,
          data,
          calcResult,
          index,
          undefined,
          undefined,
          boundaryCheck.reason,
        ));
      }
    }
  });

  return {
    id: generateId('run'),
    name: runName,
    createdAt: new Date().toISOString(),
    params: { ...params, id: generateId('params') },
    totalCount: answers.length,
    anomalyCount: anomalies.length,
    anomalies,
  };
}

function createAnomalyRecord(
  type: AnomalyType,
  answer: HistoricalAnswer,
  data: Record<string, any>,
  calculation: ReturnType<typeof calculateRecord>,
  originalRowIndex: number,
  errorMessage?: string,
  unitMissingFields?: string[],
  boundaryReason?: string,
): AnomalyRecord {
  const isBoundary = type === 'boundary_sample';
  const suggestion = generateSuggestion(
    type,
    data,
    unitMissingFields,
    boundaryReason,
    errorMessage,
  );

  return {
    id: generateId('anomaly'),
    answerId: answer.id,
    runId: '',
    type,
    status: 'pending',
    calculation,
    isBoundary,
    boundaryReason,
    unitMissingFields,
    suggestion,
    rawSnapshot: { ...answer.rawData },
    sourceInfo: {
      source: answer.source,
      sourceBatch: answer.sourceBatch,
      originalRowIndex,
    },
    detectedAt: new Date().toISOString(),
  };
}

export function updateAnomalyStatus(
  run: CalculationRun,
  anomalyId: string,
  status: AnomalyRecord['status']
): CalculationRun {
  return {
    ...run,
    anomalies: run.anomalies.map(a =>
      a.id === anomalyId ? { ...a, status } : a
    ),
  };
}

export function getAnomalyStats(run: CalculationRun) {
  const stats = {
    total: run.totalCount,
    anomalyCount: run.anomalyCount,
    byType: {
      unit_missing: 0,
      boundary_sample: 0,
      bad_data: 0,
      calculation_error: 0,
    } as Record<AnomalyType, number>,
    byStatus: {
      pending: 0,
      reviewing: 0,
      resolved: 0,
      ignored: 0,
    } as Record<AnomalyRecord['status'], number>,
    normalCount: run.totalCount - run.anomalyCount,
  };

  for (const anomaly of run.anomalies) {
    stats.byType[anomaly.type]++;
    stats.byStatus[anomaly.status]++;
  }

  return stats;
}
