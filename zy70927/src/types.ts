export interface AttendanceItem {
  employeeId: string;
  employeeName: string;
  department: string;
  signInTime: string;
  signOutTime: string;
}

export interface TrainingMaterial {
  trainingId: string;
  trainingName: string;
  trainer: string;
  trainingDate: string;
  startTime: string;
  endTime: string;
  location: string;
  attendance: AttendanceItem[];
}

export interface BatchSubmitRequest {
  batchId?: string;
  materials: TrainingMaterial[];
  submittedBy: string;
}

export interface ValidationError {
  materialIndex: number;
  attendanceIndex?: number;
  field: string;
  value: any;
  error: string;
}

export interface BatchSubmitResponse {
  batchId: string;
  isDuplicate: boolean;
  status: 'success' | 'partial' | 'failed';
  totalMaterials: number;
  validMaterials: number;
  invalidMaterials: number;
  errors: ValidationError[];
  certificates: CertificateInfo[];
  createdAt: string;
}

export interface CertificateInfo {
  certificateId: string;
  trainingId: string;
  trainingName: string;
  employeeId: string;
  employeeName: string;
  department: string;
  issueDate: string;
  qrCode: string;
}

export interface TraceRecord {
  traceId: string;
  batchId: string;
  fieldName: string;
  source: 'raw_input' | 'validation' | 'processing' | 'certificate';
  value: string;
  timestamp: string;
  operator?: string;
  remark?: string;
}

export interface TraceQueryResponse {
  batchId: string;
  trainingId?: string;
  employeeId?: string;
  traceChain: TraceRecord[];
  rawMaterial: TrainingMaterial | null;
  certificate: CertificateInfo | null;
}
