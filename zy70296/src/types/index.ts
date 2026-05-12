export interface Patient {
  id: string;
  name: string;
  gender: '男' | '女';
  age: number;
  idCard: string;
  phone: string;
}

export interface Exam {
  id: string;
  examNo: string;
  examType: string;
  examDate: string;
  examTime: string;
  patientId: string;
  patientName: string;
  department: string;
  attendingDoctor: string;
  examResult: string;
  filmCount: number;
  status: 'pending' | 'ready' | 'printed' | 'reprinted';
}

export interface FilmPickup {
  id: string;
  pickupCode: string;
  examNo: string;
  patientId: string;
  patientName: string;
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'used' | 'expired' | 'cancelled';
}

export interface PrintRecord {
  id: string;
  examNo: string;
  pickupCode: string;
  patientId: string;
  patientName: string;
  printType: 'original' | 'reprint';
  printedAt: string;
  filmCount: number;
  operatorId?: string;
  operatorName?: string;
  status: 'success' | 'failed' | 'pending';
  printerId: string;
  printerName: string;
}

export interface ReprintRequest {
  id: string;
  examNo: string;
  patientId: string;
  patientName: string;
  pickupCode: string;
  reason: string;
  applicantName: string;
  applicantId: string;
  appliedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
}

export interface AbnormalRecord {
  id: string;
  examNo: string;
  pickupCode?: string;
  patientId: string;
  patientName: string;
  type: 'code_invalid' | 'code_expired' | 'code_used' | 'mismatch' | 'printer_error' | 'other';
  description: string;
  occurredAt: string;
  status: 'pending' | 'resolved' | 'ignored';
  resolvedBy?: string;
  resolvedAt?: string;
  resolution?: string;
}

export interface HistoryEntry {
  id: string;
  type: 'pickup' | 'print' | 'reprint_request' | 'reprint_review' | 'abnormal' | 'export';
  targetId: string;
  action: string;
  operatorId?: string;
  operatorName?: string;
  timestamp: string;
  details: Record<string, any>;
}

export interface Statistics {
  totalPickups: number;
  totalPrints: number;
  reprintRequests: number;
  approvedReprints: number;
  rejectedReprints: number;
  pendingReprints: number;
  abnormalRecords: number;
  resolvedAbnormals: number;
}
