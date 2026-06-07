export type InspectionStatus = 'pending' | 'processing' | 'confirmed' | 'rejected' | 'need_review';

export type ConflictType = 'sampling_vs_complaint' | 'duplicate_import' | 'ramp_score_unchanged';

export interface NightSamplingPoint {
  id: string;
  pointCode: string;
  location: string;
  illumination: number;
  hasRamp: boolean;
  score: number;
  importTime: string;
  importBatch: string;
  isDuplicate?: boolean;
}

export interface ResidentComplaint {
  id: string;
  complaintCode: string;
  pointCode: string;
  location: string;
  description: string;
  reportTime: string;
}

export interface InspectionRecord {
  id: string;
  pointCode: string;
  location: string;
  nightSampling: NightSamplingPoint | null;
  complaints: ResidentComplaint[];
  score: number;
  originalScore: number;
  rampSupplementTime?: string;
  rampScoreUnchanged: boolean;
  status: InspectionStatus;
  conflictEvidence: ConflictEvidence[];
  rectificationSuggestion: string;
  reviewer?: string;
  updateTime: string;
  createTime: string;
}

export interface ConflictEvidence {
  id: string;
  type: ConflictType;
  description: string;
  samplingData?: Partial<NightSamplingPoint>;
  complaintData?: Partial<ResidentComplaint>;
  resolved: boolean;
  resolution?: 'confirmed' | 'rejected';
  resolvedBy?: string;
  resolvedTime?: string;
}

export interface SelfCheckResult {
  id: string;
  checkType: 'duplicate_import' | 'ramp_score_unchanged' | 'recalculate_after_supplement' | 'export_consistency';
  checkName: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  affectedRecords: string[];
  checkTime: string;
}

export interface ExportData {
  records: InspectionRecord[];
  exportTime: string;
  operator: string;
  checksum: string;
}
