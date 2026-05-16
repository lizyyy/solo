export enum ScanStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  SCANNING = 'scanning',
  SUCCESS = 'success',
  FAILED = 'failed',
  ISOLATED = 'isolated',
  MANUAL_REVIEW = 'manual_review',
  RELEASED = 'released'
}

export enum RiskLevel {
  SAFE = 'safe',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum IsolationAction {
  NONE = 'none',
  QUARANTINE = 'quarantine',
  DELETE = 'delete',
  HOLD = 'hold'
}

export enum ScanEngine {
  CLAMAV = 'clamav',
  WINDOWS_DEFENDER = 'windows_defender',
  MCCAFE = 'mccafe',
  KASPERSKY = 'kaspersky'
}

export interface Attachment {
  id: string;
  filename: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
}

export interface FailureRecord {
  step: string;
  errorMessage: string;
  rawInput: any;
  processingBasis: string;
  finalConclusion: string;
  timestamp: Date;
}

export interface TicketScanRecord {
  id: string;
  ticketId: string;
  attachments: Attachment[];
  scanEngine: ScanEngine;
  riskLevel: RiskLevel;
  isolationAction: IsolationAction;
  status: ScanStatus;
  processingSummary: string;
  scanReport?: string;
  virusFound?: string[];
  failureRecords?: FailureRecord[];
  reviewedBy?: string;
  reviewComment?: string;
  createdAt: Date;
  updatedAt: Date;
  scannedAt?: Date;
  reviewedAt?: Date;
}

export interface CreateScanRequest {
  ticketId: string;
  attachments: Omit<Attachment, 'id'>[];
  scanEngine?: ScanEngine;
}

export interface UpdateStatusRequest {
  status: ScanStatus;
  scanReport?: string;
  virusFound?: string[];
  riskLevel?: RiskLevel;
  processingSummary?: string;
}

export interface ManualCorrectionRequest {
  reviewedBy: string;
  reviewComment: string;
  action: 'release' | 'isolate' | 'retry';
  riskLevel?: RiskLevel;
  processingSummary?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}
