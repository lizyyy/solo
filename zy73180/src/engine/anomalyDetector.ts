import type {
  HistoricalAnswer,
  AnomalyRecord,
  AnomalyType,
  CalculationRun,
  CalculationParams,
  FieldMapping,
  FieldMappingInfo,
} from '@/types';
import {
  calculateRecord,
  checkUnitCompletenessAndValidity,
  isBoundarySample,
  isBadData,
  generateSuggestion,
} from './calculator';
import { applyMapping } from './fieldMapper';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function buildFieldMappingInfo(
  rawData: Record<string, any>,
  mapping: FieldMapping
): FieldMappingInfo[] {
  const infos: FieldMappingInfo[] = [];
  for (const [rawField, targetField] of Object.entries(mapping.mappings)) {
    infos.push({
      rawFieldName: rawField,
      targetFieldName: targetField,
      rawValue: rawData[rawField],
      mappedValue: rawData[rawField],
    });
  }
  return infos;
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

  const mappedDataList: {
    data: Record<string, any>;
    answer: HistoricalAnswer;
    mapping: FieldMapping;
    index: number;
    fieldMappingInfo: FieldMappingInfo[];
  }[] = [];

  answers.forEach((answer, index) => {
    const mapping = mappingMap.get(answer.fieldMappingId);
    if (!mapping) return;

    const mapped = applyMapping(answer.rawData, mapping);
    const fieldMappingInfo = buildFieldMappingInfo(answer.rawData, mapping);

    mappedDataList.push({ data: mapped, answer, mapping, index, fieldMappingInfo });

    const badCheck = isBadData(mapped);
    if (!badCheck.isBad && mapped.value !== undefined && mapped.value !== null) {
      const numValue = Number(mapped.value);
      if (isFinite(numValue)) {
        allValues.push(numValue);
      }
    }
  });

  mappedDataList.forEach(({ data, answer, mapping, index, fieldMappingInfo }) => {
    const unitCheck = checkUnitCompletenessAndValidity(data, mapping.mappings, params);

    if (unitCheck.hasIssues) {
      const calcResult = calculateRecord(data, params);

      if (unitCheck.missingFields.length > 0) {
        const missingRawFields = unitCheck.missingFields.map(f => ({
          rawFieldName: f.rawFieldName,
          targetFieldName: f.targetFieldName,
        }));

        anomalies.push(createAnomalyRecord(
          'unit_missing',
          answer,
          data,
          calcResult,
          index,
          fieldMappingInfo,
          mapping,
          undefined,
          unitCheck.missingFields,
          undefined,
          undefined,
          undefined,
          missingRawFields,
        ));
      }

      if (unitCheck.invalidUnits.length > 0) {
        const invalidDetails = unitCheck.invalidUnits.map(u => ({
          field: u.field.rawFieldName,
          value: u.value,
          allowed: u.allowed,
        }));

        anomalies.push(createAnomalyRecord(
          'unit_invalid',
          answer,
          data,
          calcResult,
          index,
          fieldMappingInfo,
          mapping,
          undefined,
          undefined,
          unitCheck.invalidUnits,
          invalidDetails,
        ));
      }

      return;
    }

    const badCheck = isBadData(data);

    if (badCheck.isBad) {
      const calcResult = calculateRecord(data, params);
      anomalies.push(createAnomalyRecord(
        'bad_data',
        answer,
        data,
        calcResult,
        index,
        fieldMappingInfo,
        mapping,
        badCheck.reason,
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
        fieldMappingInfo,
        mapping,
        calcResult.errorMessage,
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
          fieldMappingInfo,
          mapping,
          undefined,
          undefined,
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
  fieldMappingInfo: FieldMappingInfo[],
  mapping: FieldMapping,
  errorMessage?: string,
  unitMissingFields?: FieldMappingInfo[],
  unitInvalidUnits?: { field: FieldMappingInfo; value: string; allowed: string[] }[],
  invalidDetails?: { field: string; value: string; allowed: string[] }[],
  boundaryReason?: string,
  missingRawFields?: { rawFieldName: string; targetFieldName: string }[],
): AnomalyRecord {
  const isBoundary = type === 'boundary_sample';

  let unitIssue: AnomalyRecord['unitIssue'] | undefined;
  if (type === 'unit_missing' && unitMissingFields) {
    unitIssue = {
      type: 'missing',
      affectedFields: unitMissingFields,
    };
  } else if (type === 'unit_invalid' && unitInvalidUnits) {
    unitIssue = {
      type: 'invalid',
      affectedFields: unitInvalidUnits.map(u => u.field),
      invalidUnits: unitInvalidUnits.map(u => ({
        field: u.field.rawFieldName,
        value: u.value,
        allowed: u.allowed,
      })),
    };
  }

  const suggestion = generateSuggestion(
    type,
    data,
    missingRawFields,
    boundaryReason,
    errorMessage,
    invalidDetails,
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
    unitIssue,
    fieldMappingInfo,
    suggestion,
    rawSnapshot: { ...answer.rawData },
    sourceInfo: {
      source: answer.source,
      sourceBatch: answer.sourceBatch,
      originalRowIndex,
      originalFieldNames: Object.keys(answer.rawData),
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
      unit_invalid: 0,
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
