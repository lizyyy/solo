export enum Severity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum CardStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed'
}

export interface CodeLocation {
  id: string;
  cardId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
  lineContent: string;
  contextBefore: string[];
  contextAfter: string[];
  createdAt: string;
}

export interface Attachment {
  id: string;
  cardId: string;
  type: 'screenshot' | 'log' | 'image';
  name: string;
  data: string;
  mimeType: string;
  createdAt: string;
}

export interface ReviewRecord {
  id: string;
  cardId: string;
  reviewer: string;
  action: string;
  comment: string;
  oldStatus?: CardStatus;
  newStatus?: CardStatus;
  createdAt: string;
}

export interface ReviewCard {
  id: string;
  prId: string;
  title: string;
  description: string;
  severity: Severity;
  status: CardStatus;
  codeLocations: CodeLocation[];
  attachments: Attachment[];
  reviewRecords: ReviewRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface PullRequest {
  id: string;
  title: string;
  description?: string;
  sourceBranch: string;
  targetBranch: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiffFile {
  filePath: string;
  oldFilePath?: string;
  isNew: boolean;
  isDeleted: boolean;
  isRename: boolean;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  lineNumber: number;
}

export interface CreateCardRequest {
  prId: string;
  title: string;
  description: string;
  severity: Severity;
  codeLocation?: Omit<CodeLocation, 'id' | 'cardId' | 'createdAt'>;
  attachment?: Omit<Attachment, 'id' | 'cardId' | 'createdAt'>;
}

export interface UpdateCardRequest {
  title?: string;
  description?: string;
  severity?: Severity;
  status?: CardStatus;
}

export interface ImportDiffRequest {
  prTitle: string;
  diffContent: string;
  sourceBranch?: string;
  targetBranch?: string;
}

export interface ExportMarkdownOptions {
  includeAttachments?: boolean;
  includeReviewHistory?: boolean;
  statusFilter?: CardStatus[];
  severityFilter?: Severity[];
}
