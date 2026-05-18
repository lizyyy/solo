export enum AppealStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  NEEDS_MORE_INFO = 'needs_more_info',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export enum FoulType {
  PERSONAL = 'personal',
  TECHNICAL = 'technical',
  FLAGRANT = 'flagrant',
  OFFENSIVE = 'offensive',
  DEFENSIVE = 'defensive',
  DOUBLE = 'double'
}

export enum FoulSeverity {
  MINOR = 'minor',
  MODERATE = 'moderate',
  MAJOR = 'major'
}

export interface GameInfo {
  gameId: string;
  leagueName: string;
  division: string;
  round: string;
  gameDate: string;
  gameTime: string;
  venue: string;
  homeTeam: string;
  awayTeam: string;
  quarter: number;
  gameMinute: number;
  gameSecond: number;
  scoreAtTime: {
    home: number;
    away: number;
  };
}

export interface FoulPlayer {
  playerNumber: string;
  playerName: string;
  teamName: string;
  position: string;
  foulsBefore: number;
}

export interface FoulDetail {
  foulId: string;
  foulType: FoulType;
  severity: FoulSeverity;
  description: string;
  fouler: FoulPlayer;
  victim?: FoulPlayer;
  referees: string[];
  videoEvidence?: string[];
  witnessPlayers?: string[];
}

export interface AppealContent {
  appealingTeam: string;
  teamRepresentative: {
    name: string;
    role: string;
    phone: string;
    email: string;
  };
  appealReason: string;
  appealBasis: string[];
  requestedOutcome: string;
  supportingDocuments: string[];
  additionalNotes?: string;
}

export interface ReviewRecord {
  reviewerId: string;
  reviewerName: string;
  reviewTime: string;
  reviewResult: 'pending' | 'approved' | 'rejected' | 'needs_info';
  reviewComments: string;
  requiredActions?: string[];
}

export interface AuditLog {
  action: string;
  operatorId: string;
  operatorName: string;
  operatorRole: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  changes: Record<string, { old: any; new: any }>;
}

export interface FoulAppeal {
  id: string;
  appealNumber: string;
  gameInfo: GameInfo;
  foulDetail: FoulDetail;
  appealContent: AppealContent;
  status: AppealStatus;
  currentReviewer?: string;
  reviewHistory: ReviewRecord[];
  auditLogs: AuditLog[];
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  resolvedAt?: string;
  crossReferencedAppeals: string[];
  consistencyScore?: number;
  tags: string[];
}

export interface CreateAppealRequest {
  gameInfo: Omit<GameInfo, 'gameId'>;
  foulDetail: Omit<FoulDetail, 'foulId'>;
  appealContent: AppealContent;
  operator: {
    id: string;
    name: string;
    role: string;
  };
}

export interface SubmitAppealRequest {
  appealId: string;
  operator: {
    id: string;
    name: string;
    role: string;
  };
}

export interface ReviewAppealRequest {
  appealId: string;
  reviewer: {
    id: string;
    name: string;
    role: string;
  };
  reviewResult: 'approved' | 'rejected' | 'needs_info';
  reviewComments: string;
  requiredActions?: string[];
}

export interface SupplementInfoRequest {
  appealId: string;
  operator: {
    id: string;
    name: string;
    role: string;
  };
  additionalDocuments?: string[];
  additionalNotes: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    suggestions: string[];
    details?: any;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

export interface StatusTransition {
  from: AppealStatus;
  to: AppealStatus;
  allowedRoles: string[];
  action: string;
  description: string;
}
