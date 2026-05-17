export enum RegistrationStatus {
  PENDING_REVIEW = 'PENDING_REVIEW',
  QUALIFIED = 'QUALIFIED',
  WAITLIST = 'WAITLIST',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  PROMOTED = 'PROMOTED'
}

export interface QualificationCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'in';
  value: any;
}

export interface AuditTrail {
  id: string;
  registrationId: string;
  action: string;
  previousStatus?: RegistrationStatus;
  newStatus?: RegistrationStatus;
  operator: string;
  comment?: string;
  timestamp: Date;
  rawInput?: any;
  processingBasis?: string;
}

export interface Training {
  id: string;
  trainingCode: string;
  name: string;
  description: string;
  maxSlots: number;
  qualificationConditions: QualificationCondition[];
  startDate: Date;
  endDate: Date;
  createdAt: Date;
}

export interface Registration {
  id: string;
  trainingId: string;
  trainingCode: string;
  applicantId: string;
  applicantName: string;
  applicantEmail: string;
  applicantData: Record<string, any>;
  status: RegistrationStatus;
  waitlistOrder?: number;
  reviewComment?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegistrationReport {
  trainingId: string;
  trainingCode: string;
  trainingName: string;
  totalRegistrations: number;
  qualifiedCount: number;
  waitlistCount: number;
  rejectedCount: number;
  cancelledCount: number;
  registrations: Registration[];
  generatedAt: Date;
}
