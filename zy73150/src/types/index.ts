export type RecordStatus = 'confirmed' | 'pending' | 'returned';

export type AnomalyType =
  | 'outlier'
  | 'duplicate_bottle'
  | 'incomplete_material'
  | 'normal';

export interface LabIndicator {
  name: string;
  value: number;
  unit: string;
  normalRange: [number, number];
}

export interface LabRecord {
  id: string;
  bottleNo: string;
  samplePoint: string;
  longitude: number;
  latitude: number;
  samplingDate: string;
  sourceTable: string;
  indicators: LabIndicator[];
  materialCompleteness: string[];
  materialMissing?: string[];
  status: RecordStatus;
  detectedAnomalies: AnomalyType[];
}

export interface AnomalyItem {
  id: string;
  recordId: string;
  record: LabRecord;
  type: AnomalyType;
  criterion: string;
  description: string;
  affectedRecordIds: string[];
  affectedRecords?: LabRecord[];
  suggestion: string;
}

export interface DataCleaningContext {
  records: LabRecord[];
  anomalies: AnomalyItem[];
}
