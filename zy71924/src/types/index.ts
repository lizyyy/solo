export type RecordStatus = 'normal' | 'pending' | 'abnormal';
export type RecordSource = 'first_entry' | 're_entry' | 'manual';

export interface RecordVersion {
  id: string;
  versionNumber: number;
  status: RecordStatus;
  operator: string;
  operatedAt: string;
  reason: string;
  lightingScheme?: string;
}

export interface InspectionRecord {
  id: string;
  materialCode: string;
  name: string;
  location: string;
  source: RecordSource;
  currentStatus: RecordStatus;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  versions: RecordVersion[];
}

export interface CurationNote {
  id: string;
  title: string;
  content: string;
  uploadedBy: string;
  uploadedAt: string;
  isSample: boolean;
}

export interface BatchOperationResult {
  successCount: number;
  failedCount: number;
  errors: string[];
}

export interface LightingScheme {
  id: string;
  version: string;
  createdAt: string;
  createdBy: string;
  content: string;
}
