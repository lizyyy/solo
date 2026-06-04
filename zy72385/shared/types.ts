export interface MaintenanceScreenshot {
  id: string;
  fileName: string;
  fileHash: string;
  fileSize: number;
  uploadTime: string;
  uploader: string;
  ocrData?: string;
  imageUrl?: string;
  extractedData?: {
    pumpId?: string;
    pressure?: number;
    flowRate?: number;
    sampleTime?: string;
    temperature?: number;
  };
  status: 'pending' | 'processing' | 'processed' | 'duplicate' | 'error';
  duplicateOf?: string;
  calculationIds: string[];
}

export interface SamplingInterval {
  id: string;
  pumpId: string;
  startTime: string;
  endTime: string;
  intervalMinutes: number;
  description: string;
  creator: string;
  createTime: string;
  updateTime: string;
  version: number;
  calculationIds: string[];
}

export interface MissingInterval {
  start: string;
  end: string;
  duration: number;
  source?: 'screenshot' | 'sampling';
}

export interface CavitationCalculation {
  id: string;
  pumpId: string;
  name: string;
  screenshotIds: string[];
  samplingIntervalIds: string[];
  status: 'draft' | 'pending_review' | 'reviewing' | 'completed';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  parameters: {
    pressure: number[];
    flowRate: number[];
    temperatures: number[];
    sampleTimes: string[];
    missingIntervals: MissingInterval[];
  };
  result: {
    npshAvailable: number;
    npshRequired: number;
    cavitationProbability: number;
    affectedAreas: string[];
    recommendations: string[];
  };
  remark: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  reviewAssignee?: string;
  reviewComment?: string;
}

export interface ChangeRecord {
  id: string;
  entityType: 'calculation' | 'screenshot' | 'sampling_interval';
  entityId: string;
  fieldName: string;
  oldValue: any;
  newValue: any;
  changeReason: string;
  changedBy: string;
  changedAt: string;
  affectedResults: string[];
}

export interface ReviewDecision {
  dataPointId: string;
  keepReason: string;
  missingMaterials: string[];
  nextAction: 'inspector' | 'teacher' | 'none';
  assignee?: string;
}

export interface ExperimentReview {
  id: string;
  calculationId: string;
  decisions: ReviewDecision[];
  reportContent: string;
  createdAt: string;
  createdBy: string;
}

export interface ReviewTask {
  id: string;
  calculationId: string;
  type: 'missing_interval' | 'data_anomaly' | 'result_review';
  description: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'rejected';
  assignee: string;
  createdAt: string;
  resolvedAt?: string;
  resolution?: string;
  missingInterval?: MissingInterval;
}

export interface User {
  id: string;
  name: string;
  role: 'teacher' | 'inspector' | 'admin';
  avatar?: string;
}

export interface DataTraceInfo {
  calculationId: string;
  dataPointIndex: number;
  sourceType: 'screenshot' | 'sampling';
  sourceId: string;
  fieldName: string;
  value: number | string;
  timestamp: string;
}

export type ViewMode = 'list' | '3d' | 'chart';
