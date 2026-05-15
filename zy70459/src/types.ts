export interface LabSample {
  id: string;
  businessNo: string;
  sampleNo: string;
  patientName: string;
  patientId: string;
  sampleType: string;
  collectTime: Date;
  receiveTime: Date;
  testItems: string[];
  department: string;
  doctor: string;
  status: 'pending' | 'validating' | 'validated' | 'failed';
  rawData: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationRecord {
  id: string;
  businessNo: string;
  sampleId: string;
  validationType: string;
  windowStart: Date;
  windowEnd: Date;
  status: 'success' | 'failed' | 'processing';
  result?: string;
  operator: string;
  createdAt: Date;
}

export interface FailureRecord {
  id: string;
  businessNo: string;
  sampleId: string;
  validationId?: string;
  failureType: string;
  errorCode: string;
  errorMessage: string;
  gatewayError?: string;
  correctionSuggestion?: string;
  conclusion?: string;
  rawPayload: string;
  retryCount: number;
  createdAt: Date;
}

export interface AnomalySample {
  id: string;
  businessNo: string;
  sampleId: string;
  anomalyType: string;
  description: string;
  originalRecordId: string;
  detectedAt: Date;
}

export interface BatchOperation {
  id: string;
  operationType: string;
  status: 'preview' | 'executing' | 'completed' | 'cancelled';
  affectedCount: number;
  previewData?: string;
  operator: string;
  createdAt: Date;
  executedAt?: Date;
}

export interface ValidationResult {
  businessNo: string;
  success: boolean;
  status: string;
  validationRecord?: ValidationRecord;
  failureRecord?: FailureRecord;
  originalSample?: LabSample;
}

export interface SummaryItem {
  businessNo: string;
  gatewayError?: string;
  correction?: string;
  conclusion: string;
  status: string;
}
