export enum AuthorizationStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  SUSPENDED = 'suspended'
}

export enum PickupType {
  PARENT = 'parent',
  GRANDPARENT = 'grandparent',
  TEMPORARY = 'temporary',
  DESIGNATED_PERSON = 'designated_person'
}

export enum RelationType {
  FATHER = 'father',
  MOTHER = 'mother',
  GRANDFATHER = 'grandfather',
  GRANDMOTHER = 'grandmother',
  UNCLE = 'uncle',
  AUNT = 'aunt',
  FRIEND = 'friend',
  OTHER = 'other'
}

export enum SubmissionSource {
  WEB_PORTAL = 'web_portal',
  MOBILE_APP = 'mobile_app',
  DESKTOP = 'desktop',
  ADMIN_PANEL = 'admin_panel',
  API = 'api'
}

export interface Child {
  id: string;
  name: string;
  chineseName?: string;
  birthDate: string;
  gender: 'male' | 'female';
  classId: string;
  className: string;
  medicalNotes?: string;
  allergies?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Guardian {
  id: string;
  name: string;
  chineseName?: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  idCardNumber?: string;
  relationType: RelationType;
  isPrimary: boolean;
  isBlacklisted: boolean;
  blacklistReason?: string;
  blacklistedAt?: string;
  blacklistedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PickupAuthorization {
  id: string;
  childId: string;
  childName: string;
  guardianId: string;
  guardianName: string;
  pickupType: PickupType;
  relationType: RelationType;
  effectiveStartDate: string;
  effectiveEndDate: string;
  daysOfWeek?: number[];
  specificDates?: string[];
  startTime?: string;
  endTime?: string;
  status: AuthorizationStatus;
  statusHistory: StatusChangeRecord[];
  notes?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  idVerificationRequired: boolean;
  photoVerified: boolean;
  submissionSource: SubmissionSource;
  submittedAt: string;
  submittedBy: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatusChangeRecord {
  fromStatus?: AuthorizationStatus;
  toStatus: AuthorizationStatus;
  changedAt: string;
  changedBy: string;
  reason: string;
}

export interface BlacklistEntry {
  id: string;
  guardianId: string;
  guardianName: string;
  reason: string;
  effectiveDate: string;
  expiryDate?: string;
  isPermanent: boolean;
  reportedBy: string;
  reportedAt: string;
  createdAt: string;
}

export interface ConsistencyCheckResult {
  isValid: boolean;
  issues: ConsistencyIssue[];
}

export interface ConsistencyIssue {
  type: 'blacklist_conflict' | 'overlapping_authorization' | 'expired' | 'invalid_dates' | 'missing_fields';
  severity: 'error' | 'warning' | 'info';
  message: string;
  affectedAuthorizationId?: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}
