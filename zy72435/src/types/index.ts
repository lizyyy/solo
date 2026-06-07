export interface User {
  id: string;
  name: string;
  role: 'tour_coordinator' | 'ticket_staff' | 'reviewer';
  avatar?: string;
}

export interface AudioFileRemark {
  id: string;
  fileName: string;
  songName: string;
  artist: string;
  duration: number;
  fileHash: string;
  remark: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  version: number;
  isActive: boolean;
}

export interface HistoryEntry<T> {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: 'create' | 'update' | 'delete' | 'import';
  field?: keyof T;
  oldValue?: any;
  newValue?: any;
  remark?: string;
}

export interface AuthorizationPeriod {
  id: string;
  audioFileId: string;
  songName: string;
  authorizedPlatform: string[];
  startDate: string;
  endDate: string;
  authorizedRegion: string[];
  status: 'valid' | 'expiring' | 'expired';
  licenseNumber: string;
  remarks: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  history: HistoryEntry<AuthorizationPeriod>[];
}

export type ComplianceStatus = 'compliant' | 'pending' | 'non_compliant' | 'needs_review';
export type NextStepOwner = 'tour_coordinator' | 'ticket_staff' | 'legal' | 'artist_management';

export interface ComplianceIssue {
  id: string;
  type: 'missing_auth' | 'expired_auth' | 'incomplete_remark' | 'substitute_unverified' | 'region_restriction';
  severity: 'high' | 'medium' | 'low';
  description: string;
}

export interface ComplianceCheck {
  id: string;
  audioFileId: string;
  songName: string;
  artist: string;
  checkDate: string;
  status: ComplianceStatus;
  issues: ComplianceIssue[];
  checkedBy: string;
  remarks: string;
  keptReason: string;
  missingMaterials: string[];
  nextStep: string;
  nextStepOwner: NextStepOwner;
  isSubstitute: boolean;
  substituteSource?: 'wechat_group' | 'official_notice' | 'other';
  substituteVerified: boolean;
  createdAt: string;
  updatedAt: string;
  history: HistoryEntry<ComplianceCheck>[];
}

export interface SettlementDetail {
  id: string;
  complianceCheckId: string;
  songName: string;
  artist: string;
  keptReason: string;
  missingMaterials: string[];
  nextStep: string;
  nextStepOwner: NextStepOwner;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  createdAt: string;
  updatedAt: string;
}

export interface SubstituteSong {
  id: string;
  originalSongId: string;
  originalSongName: string;
  substituteSongName: string;
  substituteArtist: string;
  sourceType: 'wechat_group' | 'official_notice' | 'other';
  sourceDetail: string;
  status: 'pending_review' | 'approved' | 'rejected';
  notifiedBy: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewRemark?: string;
  createdAt: string;
}

export type PageType = 'audio_remarks' | 'authorization' | 'compliance_check' | 'settlement' | 'substitute_review' | 'compliance_chart';
