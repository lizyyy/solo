export enum GrayReleaseStatus {
  DRAFT = 'draft',
  IN_GRAY = 'in_gray',
  FULL_RELEASE = 'full_release',
  ROLLED_BACK = 'rolled_back',
  PENDING_MANUAL = 'pending_manual'
}

export interface GrayReleaseRecord {
  id: string;
  robotId: string;
  robotName: string;
  templateVersion: string;
  templateName: string;
  grayGroups: string[];
  failedSamples: FailedSample[];
  status: GrayReleaseStatus;
  remark: string;
  conflictReason?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  history: HistoryRecord[];
}

export interface FailedSample {
  groupId: string;
  groupName: string;
  messageId: string;
  errorMessage: string;
  timestamp: string;
}

export interface HistoryRecord {
  id: string;
  action: string;
  previousStatus?: GrayReleaseStatus;
  newStatus?: GrayReleaseStatus;
  operator: string;
  remark: string;
  timestamp: string;
}

export interface BatchImportResult {
  success: number;
  failed: number;
  errors: ImportError[];
  importedIds: string[];
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
  rawData: Record<string, any>;
}

export interface ConflictInfo {
  hasConflict: boolean;
  reason: string;
  details: {
    groupId: string;
    groupName: string;
    oldTemplateVersion: string;
    newTemplateVersion: string;
    lastSendTime: string;
  }[];
}
