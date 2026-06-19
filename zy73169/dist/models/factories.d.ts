import type { Sample, SampleSource, Anomaly, AnomalyType, FittingParams, FittingMethod, ChangeRecord, FittingSession, SampleStatus } from './types';
export declare function createSample(x: number, y: number, source: SampleSource, status?: SampleStatus): Sample;
export declare function createAnomaly(type: AnomalyType, description: string, severity?: 'low' | 'medium' | 'high', relatedSampleIds?: string[]): Anomaly;
export declare function createFittingParams(method: FittingMethod, coefficients: number[], rSquared: number, sampleIds: string[], excludedSampleIds: string[], calculatedBy: string, degree?: number): FittingParams;
export declare function createChangeRecord(entityType: 'sample' | 'fitting' | 'anomaly', entityId: string, field: string, oldValue: unknown, newValue: unknown, changedBy: string, reason?: string): ChangeRecord;
export declare function createFittingSession(name: string, createdBy: string): FittingSession;
