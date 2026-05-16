export enum LeaseStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  BLOCKED = 'blocked',
  REVOKED = 'revoked',
  COMPENSATED = 'compensated',
  EXPIRED = 'expired',
  RECYCLED = 'recycled'
}

export enum RenewalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export interface PermissionLease {
  id: string;
  accountName: string;
  permissionItem: string;
  leaseStartTime: number;
  leaseEndTime: number;
  applicationReason: string;
  applicant: string;
  status: LeaseStatus;
  idempotencyKey: string;
  createdAt: number;
  updatedAt: number;
  recyclingConclusion?: string;
  blockedReason?: string;
}

export interface RenewalRecord {
  id: string;
  leaseId: string;
  previousEndTime: number;
  newEndTime: number;
  renewalReason: string;
  approver?: string;
  status: RenewalStatus;
  createdAt: number;
  approvedAt?: number;
}

export interface AuditLog {
  id: string;
  leaseId: string;
  operationType: string;
  operator: string;
  originalInput: any;
  processingBasis: string;
  finalConclusion: string;
  statusBefore: LeaseStatus;
  statusAfter: LeaseStatus;
  createdAt: number;
}

export interface CreateLeaseRequest {
  accountName: string;
  permissionItem: string;
  leaseDurationHours: number;
  applicationReason: string;
  applicant: string;
  idempotencyKey: string;
}

export interface QueryLeaseRequest {
  accountName?: string;
  status?: LeaseStatus;
  startTime?: number;
  endTime?: number;
  page?: number;
  pageSize?: number;
}

export interface StatusAdvanceRequest {
  leaseId: string;
  targetStatus: LeaseStatus;
  operator: string;
  reason: string;
}

export interface RenewalRequest {
  leaseId: string;
  additionalHours: number;
  renewalReason: string;
  applicant: string;
}

export interface ManualCorrectionRequest {
  leaseId: string;
  updates: Partial<PermissionLease>;
  operator: string;
  correctionReason: string;
}
