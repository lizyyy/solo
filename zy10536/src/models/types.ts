export enum DefectStatus {
  REGISTERED = 'registered',
  IN_RECTIFICATION = 'in_rectification',
  PENDING_REINSPECTION = 'pending_reinspection',
  PASSED = 'passed',
  CLOSED = 'closed'
}

export enum DefectType {
  APPEARANCE = 'appearance',
  FUNCTIONAL = 'functional',
  DOCUMENTATION = 'documentation',
  PERFORMANCE = 'performance',
  SAFETY = 'safety',
  OTHER = 'other'
}

export interface DefectPhoto {
  id: string;
  url: string;
  filename: string;
  uploadedAt: Date;
  uploadedBy: string;
}

export interface ReinspectionRecord {
  id: string;
  defectId: string;
  inspector: string;
  inspectionDate: Date;
  result: 'pass' | 'fail' | 'partial';
  remarks: string;
  photos?: DefectPhoto[];
  createdAt: Date;
}

export interface RectificationRequirement {
  id: string;
  defectId: string;
  content: string;
  deadline: Date;
  responsiblePerson: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Defect {
  id: string;
  procurementOrderNo: string;
  equipmentNo: string;
  defectType: DefectType;
  description: string;
  status: DefectStatus;
  photos: DefectPhoto[];
  rectification?: RectificationRequirement;
  reinspections: ReinspectionRecord[];
  inspector: string;
  registeredAt: Date;
  updatedAt: Date;
  isOverdue?: boolean;
}

export interface AcceptanceReport {
  id: string;
  procurementOrderNo: string;
  equipmentNos: string[];
  generatedAt: Date;
  generatedBy: string;
  totalDefects: number;
  passedDefects: number;
  pendingDefects: number;
  status: 'draft' | 'finalized';
  content?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  requestId?: string;
}

export interface ExceptionLog {
  id: string;
  requestId: string;
  endpoint: string;
  method: string;
  rawInput: any;
  errorMessage: string;
  errorStack?: string;
  handlingBasis: string;
  createdAt: Date;
}

export interface CreateDefectRequest {
  procurementOrderNo: string;
  equipmentNo: string;
  defectType: DefectType;
  description: string;
  inspector: string;
  photos?: DefectPhoto[];
}

export interface UpdateDefectStatusRequest {
  status: DefectStatus;
  operator: string;
  remarks?: string;
  rectification?: Omit<RectificationRequirement, 'id' | 'defectId' | 'createdAt' | 'updatedAt'>;
  reinspection?: Omit<ReinspectionRecord, 'id' | 'defectId' | 'createdAt'>;
}

export interface ManualCorrectionRequest {
  field: string;
  oldValue: any;
  newValue: any;
  reason: string;
  operator: string;
}
