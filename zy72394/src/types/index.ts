export interface SafetyThreshold {
  id: string;
  thresholdCode: string;
  minTemp: number;
  maxTemp: number;
  warningTemp: number;
  description: string;
  version: string;
  createdAt: string;
  importedBy?: string;
}

export interface Equipment {
  id: string;
  equipmentCode: string;
  equipmentName: string;
  model: string;
  accuracy: number;
  manufacturer: string;
  installDate: string;
  status: 'active' | 'maintenance' | 'inactive';
}

export interface TemperatureRecord {
  id: string;
  thresholdId: string;
  equipmentId: string;
  temperature: number;
  manualCoefficient?: number;
  remark?: string;
  status: 'normal' | 'warning' | 'error' | 'pending_review';
  reviewReason?: string;
  parameterVersion?: string;
  tradeOffReason?: string;
  position?: { x: number; y: number; z: number };
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface RecordHistory {
  id: string;
  recordId: string;
  userId: string;
  userName: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  changeReason?: string;
  createdAt: string;
}

export interface ReviewTask {
  id: string;
  recordId: string;
  assigneeId: string;
  assigneeName: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewComment?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface User {
  id: string;
  name: string;
  role: 'trainer' | 'engineer' | 'admin';
  avatar?: string;
}

export interface ImportResult {
  newItems: SafetyThreshold[];
  updatedItems: SafetyThreshold[];
  skippedCount: number;
  duplicateCount: number;
}

export interface ReportSection {
  title: string;
  content: string;
  responsibleRole?: 'trainer' | 'engineer' | 'admin';
  missingMaterials?: string[];
  nextAction?: string;
}

export interface TrackingReport {
  id: string;
  title: string;
  generatedAt: string;
  sections: ReportSection[];
  recordIds: string[];
}

export type ViewMode = '3d' | 'chart' | 'table';
