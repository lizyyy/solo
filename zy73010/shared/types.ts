export type ReviewStatus = 'pending' | 'approved' | 'exception' | 'needsInfo';
export type ExceptionType = 'weight' | 'vaccine' | 'photo' | 'verbal' | 'withdrawn';
export type InfluenceType = 'weightVersion' | 'withdrawnRecord' | 'verbalNote';

export interface WeightPoint {
  date: string;
  weight: number;
  version: number;
  isCurrent: boolean;
  remark: string;
  photoUrl?: string;
}

export interface VaccineRecord {
  name: string;
  date: string | null;
  isMissing: boolean;
}

export interface InfluenceTraceItem {
  id: string;
  type: InfluenceType;
  timestamp: string;
  content: string;
  affectsConclusion: boolean;
  operator: string;
}

export interface ReviewRemark {
  id: string;
  recordId: string;
  content: string;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
  isSupplement: boolean;
  operator: string;
}

export interface BoardingRecord {
  id: string;
  petName: string;
  petBreed: string;
  ownerName: string;
  ownerPhone: string;
  startDate: string;
  endDate: string;
  reviewStatus: ReviewStatus;
  conclusion: string;
  hasWeightAnomaly: boolean;
  hasVaccineMissing: boolean;
  weightPoints: WeightPoint[];
  vaccines: VaccineRecord[];
  remarks: ReviewRemark[];
  influenceTrace: InfluenceTraceItem[];
  abnormalPhotos: { url: string; caption: string; date: string }[];
}

export interface ExceptionQueueItem {
  id: string;
  recordId: string;
  petName: string;
  exceptionType: ExceptionType;
  status: ReviewStatus;
  remark: string;
  fileConclusion: string;
  isConsistent: boolean;
  createdAt: string;
}

export interface ExportDiff {
  field: string;
  before: string;
  after: string;
  changeReason: string;
  rowIndex: number;
}

export interface ExportHistoryItem {
  id: string;
  exportType: 'report' | 'exceptions';
  operator: string;
  createdAt: string;
  changeSummary: string;
  relatedRemarkId?: string;
}

export interface ListRecordsQuery {
  status?: ReviewStatus;
  vaccineMissing?: boolean;
  weightAnomaly?: boolean;
  keyword?: string;
}
