export type MaterialSource = 'lab_result' | 'late_attachment' | 'verbal_note';

export type TideUnit = 'm' | 'cm' | 'mm';

export type AnomalyType =
  | 'unit_mismatch'
  | 'caliber_change'
  | 'time_mismatch'
  | 'value_abnormal'
  | 'missing_data';

export type Severity = 'high' | 'medium' | 'low';

export type EvidenceStatus = 'confirmed' | 'pending';

export interface Material {
  id: string;
  name: string;
  source: MaterialSource;
  version: number;
  uploadTime: string;
  content: string;
  parsedData: LabRecord[];
  isLatest: boolean;
  description?: string;
}

export interface LabRecord {
  id: string;
  stationId: string;
  stationName: string;
  sampleTime: string;
  resultTime: string;
  temperature: number;
  salinity: number;
  tideLevel: number;
  tideUnit: TideUnit;
  dissolvedOxygen: number;
  ph: number;
  sourceRow: number;
  materialId: string;
}

export interface Station {
  id: string;
  name: string;
  x: number;
  y: number;
  area: string;
}

export interface EvidenceItem {
  id: string;
  materialId: string;
  materialName: string;
  version: number;
  timestamp: string;
  content: string;
  isVerbal: boolean;
  changeType?: 'add' | 'modify' | 'delete';
  previousValue?: string;
  currentValue?: string;
  fieldName?: string;
}

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: Severity;
  stationId: string;
  stationName: string;
  description: string;
  impactRange: string;
  sourceRows: number[];
  materialIds: string[];
  materialNames: string[];
  evidenceChain: EvidenceItem[];
  status: EvidenceStatus;
  conclusionChange: string;
  detectedAt: string;
  fieldName?: string;
}

export interface FilterState {
  type: AnomalyType | 'all';
  status: EvidenceStatus | 'all';
  severity: Severity | 'all';
  stationId: string | 'all';
}
