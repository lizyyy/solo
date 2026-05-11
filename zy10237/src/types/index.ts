export enum ConsultationStatus {
  CREATED = 'CREATED',
  PRESCRIBED = 'PRESCRIBED',
  PAID = 'PAID',
  PHARMACIST_APPROVED = 'PHARMACIST_APPROVED',
  SHIPPED = 'SHIPPED',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

export enum PrescriptionStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  PHARMACIST_APPROVED = 'PHARMACIST_APPROVED',
  PHARMACIST_REJECTED = 'PHARMACIST_REJECTED'
}

export interface Consultation {
  id: string;
  consultationNo: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  status: ConsultationStatus;
  amount: number;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Prescription {
  id: string;
  prescriptionNo: string;
  consultationId: string;
  doctorId: string;
  pharmacistId?: string;
  status: PrescriptionStatus;
  rejectReason?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrescriptionItem {
  id: string;
  prescriptionId: string;
  medicineId: string;
  medicineName: string;
  specification: string;
  quantity: number;
  unit: string;
  dosage: string;
  price: number;
}

export interface StatusLog {
  id: string;
  businessType: 'CONSULTATION' | 'PRESCRIPTION';
  businessId: string;
  fromStatus?: string;
  toStatus: string;
  operatorId: string;
  operatorName: string;
  remark?: string;
  idempotentKey: string;
  createdAt: Date;
}

export interface CreateConsultationRequest {
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  idempotentKey: string;
}

export interface CreatePrescriptionRequest {
  consultationId: string;
  doctorId: string;
  items: {
    medicineId: string;
    medicineName: string;
    specification: string;
    quantity: number;
    unit: string;
    dosage: string;
    price: number;
  }[];
  idempotentKey: string;
}

export interface PharmacistReviewRequest {
  prescriptionId: string;
  pharmacistId: string;
  pharmacistName: string;
  approved: boolean;
  rejectReason?: string;
  idempotentKey: string;
}

export interface PaymentConfirmRequest {
  consultationId: string;
  amount: number;
  paymentNo: string;
  idempotentKey: string;
}

export interface ShipRequest {
  consultationId: string;
  logisticsNo: string;
  logisticsCompany: string;
  operatorId: string;
  operatorName: string;
  idempotentKey: string;
}

export interface RejectCancelRequest {
  consultationId: string;
  operatorId: string;
  operatorName: string;
  reason: string;
  idempotentKey: string;
}
