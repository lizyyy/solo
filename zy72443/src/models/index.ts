export enum SplitStatus {
  PENDING_IMPORT = 'pending_import',
  IMPORTED = 'imported',
  AUDIO_CHECKED = 'audio_checked',
  ANOMALY_DETECTED = 'anomaly_detected',
  MANAGER_REVIEWED = 'manager_reviewed',
  AUDIO_FIXED = 'audio_fixed',
  VERIFIED = 'verified',
  COMPLETED = 'completed'
}

export enum AnomalyType {
  MISSING_AUTHORIZED_CITY = 'missing_authorized_city',
  INVALID_AUDIO_REMARK = 'invalid_audio_remark',
  TICKET_AUDIO_MISMATCH = 'ticket_audio_mismatch'
}

export enum NextActionOwner {
  MANAGER = '店长',
  AUDIO_ENGINEER = '录音师小段',
  SYSTEM = '系统'
}

export interface TicketExport {
  id: string;
  ticketId: string;
  musicianName: string;
  liveDate: string;
  totalTips: number;
  platformFee: number;
  splitRatio: number;
  expectedRevenue: number;
  authorizedCities: string[];
  audioFileId: string;
  importedAt: string;
  status: SplitStatus;
}

export interface AudioFileRemark {
  id: string;
  audioFileId: string;
  ticketId: string;
  musicianName: string;
  actualAuthorizedCities: string[];
  audioDuration: number;
  qualityCheck: 'pass' | 'fail' | 'pending';
  remark: string;
  updatedBy: string;
  updatedAt: string;
}

export interface LessonVerification {
  id: string;
  verificationNo: string;
  ticketId: string;
  musicianName: string;
  liveDate: string;
  totalTips: number;
  finalRevenue: number;
  authorizedCities: string[];
  status: 'pending' | 'reserved' | 'verified' | 'rejected';
  reservedReason: string;
  missingMaterials: string[];
  nextAction: NextActionOwner;
  actionNotes: string;
  reviewedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnomalyRecord {
  id: string;
  ticketId: string;
  type: AnomalyType;
  description: string;
  severity: 'high' | 'medium' | 'low';
  detectedAt: string;
  detectedBy: string;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNotes: string | null;
  sourceData: {
    source: 'ticket_export' | 'audio_remark' | 'verification';
    fieldName: string;
    originalValue: string;
    expectedValue?: string;
  };
}

export interface SplitReport {
  reportId: string;
  generatedAt: string;
  period: string;
  summary: {
    totalTickets: number;
    totalRevenue: number;
    anomalyCount: number;
    verifiedCount: number;
    pendingCount: number;
  };
  verificationList: LessonVerification[];
  anomalyList: AnomalyRecord[];
}
