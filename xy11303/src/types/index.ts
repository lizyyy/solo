export enum TaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REWORK_NEEDED = 'rework_needed',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum ComplaintStatus {
  OPEN = 'open',
  PROCESSING = 'processing',
  RESOLVED = 'resolved',
  APPEALED = 'appealed',
  CLOSED = 'closed'
}

export enum DeductionType {
  MISSING_PHOTOS = 'missing_photos',
  OVERTIME = 'overtime',
  COMPLAINT = 'complaint',
  REWORK = 'rework',
  DAMAGE = 'damage',
  OTHER = 'other'
}

export enum SettlementStatus {
  PENDING = 'pending',
  CALCULATING = 'calculating',
  CONFIRMED = 'confirmed',
  PAID = 'paid',
  DISPUTED = 'disputed'
}

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  OPERATOR = 'operator',
  CLEANER = 'cleaner',
  FINANCE = 'finance'
}

export interface Order {
  id: string;
  orderNo: string;
  homestayId: string;
  homestayName: string;
  guestName: string;
  guestPhone: string;
  checkInDate: string;
  checkOutDate: string;
  roomCount: number;
  cleaningFee: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CleaningTask {
  id: string;
  taskNo: string;
  orderId: string;
  homestayId: string;
  homestayName: string;
  cleanerId: string;
  cleanerName: string;
  cleanerPhone: string;
  scheduledDate: string;
  deadline: string;
  status: TaskStatus;
  requiredPhotos: number;
  submittedPhotos: number;
  startedAt?: string;
  submittedAt?: string;
  approvedAt?: string;
  completedAt?: string;
  assignedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  id: string;
  taskId: string;
  uploaderId: string;
  photoType: string;
  photoUrl: string;
  thumbnailUrl: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  isApproved: boolean;
  approvedAt?: string;
}

export interface Complaint {
  id: string;
  complaintNo: string;
  orderId: string;
  taskId?: string;
  reporterId: string;
  reporterName: string;
  reporterPhone: string;
  type: string;
  title: string;
  description: string;
  status: ComplaintStatus;
  handlerId?: string;
  handlerName?: string;
  resolution?: string;
  deductionAmount: number;
  filedAt: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Rework {
  id: string;
  reworkNo: string;
  taskId: string;
  orderId: string;
  reason: string;
  requesterId: string;
  requesterName: string;
  cleanerId: string;
  cleanerName: string;
  deadline: string;
  status: TaskStatus;
  photosRequired: number;
  photosSubmitted: number;
  startedAt?: string;
  submittedAt?: string;
  approvedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Deduction {
  id: string;
  deductionNo: string;
  settlementId?: string;
  taskId: string;
  orderId: string;
  type: DeductionType;
  amount: number;
  reason: string;
  relatedId?: string;
  relatedType?: string;
  operatorId: string;
  operatorName: string;
  isAppealed: boolean;
  appealReason?: string;
  isConfirmed: boolean;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settlement {
  id: string;
  settlementNo: string;
  cleanerId: string;
  cleanerName: string;
  cleanerPhone: string;
  startDate: string;
  endDate: string;
  totalTasks: number;
  totalBaseAmount: number;
  totalReworkCount: number;
  totalReworkDeduction: number;
  totalOvertimeDeduction: number;
  totalComplaintDeduction: number;
  totalPhotoDeduction: number;
  totalOtherDeduction: number;
  totalDeduction: number;
  netAmount: number;
  status: SettlementStatus;
  paidAt?: string;
  confirmedAt?: string;
  operatorId?: string;
  operatorName?: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementItem {
  id: string;
  settlementId: string;
  taskId: string;
  orderId: string;
  taskNo: string;
  homestayName: string;
  baseAmount: number;
  reworkDeduction: number;
  overtimeDeduction: number;
  complaintDeduction: number;
  photoDeduction: number;
  otherDeduction: number;
  totalDeduction: number;
  netAmount: number;
  deductionIds: string;
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  phone: string;
  role: UserRole;
  passwordHash: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  operatorId: string;
  operatorName: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface ValidationResult {
  valid: boolean;
  passed: boolean;
  reason: string;
  rule: string;
  severity: 'info' | 'warning' | 'error';
  deductionAmount?: number;
}
