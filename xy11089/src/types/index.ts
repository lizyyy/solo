export enum AuditStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  SAFETY_CHECK = 'SAFETY_CHECK',
  WIND_WARNING_CHECK = 'WIND_WARNING_CHECK',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED'
}

export enum AuditAction {
  SUBMIT = 'SUBMIT',
  REVIEW = 'REVIEW',
  SAFETY_VERIFY = 'SAFETY_VERIFY',
  WIND_VERIFY = 'WIND_VERIFY',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  CANCEL = 'CANCEL',
  COMPLETE = 'COMPLETE',
  RESUBMIT = 'RESUBMIT'
}

export enum SubmissionSource {
  MOBILE_APP = 'MOBILE_APP',
  WEB_PORTAL = 'WEB_PORTAL',
  API_INTEGRATION = 'API_INTEGRATION',
  MANUAL_ENTRY = 'MANUAL_ENTRY'
}

export enum WindWarningLevel {
  NONE = 'NONE',
  LEVEL_1 = 'LEVEL_1',
  LEVEL_2 = 'LEVEL_2',
  LEVEL_3 = 'LEVEL_3',
  LEVEL_4 = 'LEVEL_4'
}

export interface InstallationTeam {
  teamId: string;
  teamName: string;
  leaderName: string;
  leaderPhone: string;
  teamSize: number;
  certificationLevel: string;
  certificationExpiryDate: string;
}

export interface AdvertisementInfo {
  adId: string;
  adTitle: string;
  adType: string;
  adSize: string;
  adWeight: number;
  installationHeight: number;
  installationLocation: string;
  buildingType: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export interface SafetyEquipment {
  equipmentId: string;
  equipmentName: string;
  inspectionDate: string;
  status: 'VALID' | 'EXPIRED' | 'DAMAGED';
}

export interface WindWarning {
  warningId: string;
  warningLevel: WindWarningLevel;
  windSpeed: number;
  warningTime: string;
  affectedArea: string;
  source: string;
}

export interface OperationHistory {
  id: string;
  action: AuditAction;
  previousStatus: AuditStatus;
  newStatus: AuditStatus;
  operatorId: string;
  operatorName: string;
  operationTime: string;
  submissionSource: SubmissionSource;
  remark?: string;
  ipAddress?: string;
}

export interface AuditRecord {
  id: string;
  applicationNo: string;
  status: AuditStatus;
  installationTeam: InstallationTeam;
  advertisement: AdvertisementInfo;
  safetyEquipments: SafetyEquipment[];
  plannedInstallationDate: string;
  plannedInstallationTime: string;
  windWarning?: WindWarning;
  hasWindWarningViolation: boolean;
  operationHistories: OperationHistory[];
  createdAt: string;
  updatedAt: string;
  applicantId: string;
  applicantName: string;
  currentReviewerId?: string;
  currentReviewerName?: string;
  rejectReason?: string;
  version: number;
}

export interface AuditTransition {
  from: AuditStatus;
  action: AuditAction;
  to: AuditStatus;
  allowedRoles: string[];
  conditions?: string[];
}

export interface CreateAuditRequest {
  installationTeam: Omit<InstallationTeam, 'teamId'>;
  advertisement: Omit<AdvertisementInfo, 'adId'>;
  safetyEquipments: Omit<SafetyEquipment, 'equipmentId'>[];
  plannedInstallationDate: string;
  plannedInstallationTime: string;
  applicantId: string;
  applicantName: string;
  submissionSource: SubmissionSource;
}

export interface AuditActionRequest {
  recordId: string;
  action: AuditAction;
  operatorId: string;
  operatorName: string;
  submissionSource: SubmissionSource;
  remark?: string;
  ipAddress?: string;
  windWarning?: WindWarning;
}

export interface AuditResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}
