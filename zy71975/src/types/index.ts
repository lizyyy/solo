export type IssueSeverity = 'critical' | 'warning' | 'info';

export interface Meeting {
  id: string;
  title: string;
  date: string;
  content: string;
  status: 'pending' | 'reviewing' | 'corrected' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface Knowledge {
  id: string;
  name: string;
  version: string;
  uploadDate: string;
  size: number;
  isActive: boolean;
}

export interface IssueItem {
  id: string;
  meetingId: string;
  severity: IssueSeverity;
  category: string;
  originalText: string;
  suggestedText: string;
  reason: string;
  status: 'pending' | 'resolved' | 'ignored';
  createdAt: string;
}

export interface Correction {
  id: string;
  issueId: string;
  originalText: string;
  correctedText: string;
  reason: string;
  correctedBy: string;
  correctedAt: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message: string;
  user_friendly_message: string;
  code: number;
}

export interface UploadResponse {
  fileId: string;
  fileName: string;
  uploadTime: string;
}

export interface ReviewResult {
  meetingId: string;
  issues: IssueItem[];
  totalIssues: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
}

export interface HistoryRecord {
  id: string;
  meetingId: string;
  meetingTitle: string;
  action: string;
  timestamp: string;
  user: string;
  details: string;
}

export interface VersionDiff {
  version1: string;
  version2: string;
  changes: {
    type: 'added' | 'removed' | 'modified';
    content: string;
  }[];
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}
