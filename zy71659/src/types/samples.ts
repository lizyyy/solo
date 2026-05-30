export type SampleSource = 'direct' | 'duplicate' | 'supplement';
export type AlignmentStatus = 'ok' | 'shifted' | 'interpolated' | 'missing';

export interface Calibration {
  zero: number;
  sensitivity: number;
  gain: number;
  unit: string;
}

export interface ImportBatch {
  id?: string;
  deviceId: string;
  fileName: string;
  sampleCount: number;
  importedAt: number;
  importedBy: string;
  source: SampleSource;
  relatedBatchId?: string;
  note?: string;
}

export interface RawSample {
  id?: string;
  batchId: string;
  importId: string;
  timestamp: number;
  deviceId: string;
  speed: number;
  torqueRaw: number;
  temperature: number;
  loadLevel?: number;
  source: SampleSource;
  rawLineNumber: number;
  createdAt: number;
}

export interface AlignedSample {
  id?: string;
  rawSampleId: string;
  timestamp: number;
  deviceId: string;
  speed: number;
  torque: number;
  torqueRaw: number;
  temperature: number;
  loadLevel: number;
  segmentId?: string;
  alignmentStatus: AlignmentStatus;
  shiftOffset?: number;
  anomalyIds: string[];
  calculatedAt: number;
}
