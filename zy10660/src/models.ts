export enum PrescriptionStatus {
  PRESCRIBED = 'prescribed',
  WITHDRAWING = 'withdrawing',
  NOTIFIED = 'notified',
  CLOSED = 'closed',
  REJECTED = 'rejected',
  DISPENSED = 'dispensed'
}

export interface Doctor {
  id: string;
  name: string;
  department: string;
  licenseNo: string;
}

export interface Medicine {
  id: string;
  name: string;
  specification: string;
  dosage: string;
  quantity: number;
  price: number;
}

export interface Consultation {
  id: string;
  patientName: string;
  patientId: string;
  diagnosis: string;
  consultTime: Date;
}

export interface WithdrawalRecord {
  id: string;
  prescriptionId: string;
  reason: string;
  operatorId: string;
  operatorName: string;
  operateTime: Date;
  remark?: string;
}

export interface Prescription {
  id: string;
  prescriptionNo: string;
  consultation: Consultation;
  doctor: Doctor;
  medicines: Medicine[];
  status: PrescriptionStatus;
  createdAt: Date;
  updatedAt: Date;
  isDispensed: boolean;
  withdrawalRecords: WithdrawalRecord[];
  importError?: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; message: string; data: any }>;
}

export interface WithdrawalRequest {
  prescriptionId: string;
  reason: string;
  operatorId: string;
  operatorName: string;
}

export interface AuditRequest {
  prescriptionId: string;
  approved: boolean;
  remark?: string;
  operatorId: string;
  operatorName: string;
}
