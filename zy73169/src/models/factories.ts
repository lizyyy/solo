import { v4 as uuidv4 } from 'uuid';
import type {
  Sample,
  SampleSource,
  Anomaly,
  AnomalyType,
  FittingParams,
  FittingMethod,
  ChangeRecord,
  FittingSession,
  SampleStatus,
} from './types';

export function createSample(
  x: number,
  y: number,
  source: SampleSource,
  status: SampleStatus = 'raw'
): Sample {
  const now = Date.now();
  return {
    id: uuidv4(),
    x,
    y,
    rawX: x,
    rawY: y,
    status,
    source,
    anomalies: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createAnomaly(
  type: AnomalyType,
  description: string,
  severity: 'low' | 'medium' | 'high' = 'medium',
  relatedSampleIds?: string[]
): Anomaly {
  return {
    id: uuidv4(),
    type,
    description,
    severity,
    detectedAt: Date.now(),
    detectedBy: 'system',
    relatedSampleIds,
    resolved: false,
  };
}

export function createFittingParams(
  method: FittingMethod,
  coefficients: number[],
  rSquared: number,
  sampleIds: string[],
  excludedSampleIds: string[],
  calculatedBy: string,
  degree?: number
): FittingParams {
  return {
    id: uuidv4(),
    method,
    degree,
    coefficients,
    rSquared,
    sampleIds,
    excludedSampleIds,
    calculatedAt: Date.now(),
    calculatedBy,
  };
}

export function createChangeRecord(
  entityType: 'sample' | 'fitting' | 'anomaly',
  entityId: string,
  field: string,
  oldValue: unknown,
  newValue: unknown,
  changedBy: string,
  reason?: string
): ChangeRecord {
  return {
    id: uuidv4(),
    entityType,
    entityId,
    field,
    oldValue,
    newValue,
    changedAt: Date.now(),
    changedBy,
    reason,
  };
}

export function createFittingSession(
  name: string,
  createdBy: string
): FittingSession {
  const now = Date.now();
  return {
    id: uuidv4(),
    name,
    samples: [],
    fittingParams: [],
    changeHistory: [],
    createdAt: now,
    updatedAt: now,
    createdBy,
  };
}
