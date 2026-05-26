export type FileCategory = 'contract' | 'invoice' | 'confidential' | 'meeting' | 'project';

export type ConfidentialityLevel = 'open' | 'secret' | 'confidential' | 'top_secret';

export type RetentionPeriod = 'permanent' | '30yrs' | '10yrs' | '5yrs' | '3yrs';

export type GamePhase = 'menu' | 'playing' | 'paused' | 'finished';

export interface FileCard {
  id: string;
  name: string;
  type: FileCategory;
  confidentiality: ConfidentialityLevel;
  retentionPeriod: RetentionPeriod;
  content: string;
  correctBoxId: string;
  playerConfidentiality?: ConfidentialityLevel;
  playerRetentionPeriod?: RetentionPeriod;
  playerBoxId?: string;
  isCorrect?: boolean;
  errorReason?: string;
}

export interface ArchiveBox {
  id: string;
  name: string;
  category: FileCategory;
  color: string;
  position: { x: number; y: number };
}

export interface BorrowRequest {
  id: string;
  fileId: string;
  borrower: string;
  department: string;
  purpose: string;
  needsApproval: boolean;
  approved: boolean;
  registered: boolean;
  deadline: string;
}

export interface Level {
  id: number;
  name: string;
  description: string;
  fileCount: number;
  timeLimit: number;
  targetScore: number;
  files: FileCard[];
  boxes: ArchiveBox[];
  borrowRequests?: BorrowRequest[];
}

export interface ActionRecord {
  timestamp: string;
  fileId: string;
  action: 'set_confidentiality' | 'set_retention' | 'assign_box' | 'process_borrow';
  value: string;
  isCorrect: boolean;
  errorReason?: string;
}

export interface SettlementReport {
  sessionId: string;
  levelId: number;
  levelName: string;
  totalScore: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  correctCount: number;
  wrongCount: number;
  borrowCorrectCount: number;
  borrowWrongCount: number;
  accuracy: number;
  duration: number;
  actionHistory: ActionRecord[];
  wrongActions: ActionRecord[];
  exportTime: string;
}

export interface GameSession {
  levelId: number;
  phase: GamePhase;
  currentFileIndex: number;
  timeRemaining: number;
  score: number;
  correctCount: number;
  wrongCount: number;
  actionHistory: ActionRecord[];
  startTime: string;
  endTime?: string;
}

export const FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  contract: '合同',
  invoice: '发票',
  confidential: '保密材料',
  meeting: '会议记录',
  project: '项目文件',
};

export const CONFIDENTIALITY_LABELS: Record<ConfidentialityLevel, string> = {
  open: '公开',
  secret: '秘密',
  confidential: '机密',
  top_secret: '绝密',
};

export const CONFIDENTIALITY_COLORS: Record<ConfidentialityLevel, string> = {
  open: '#27ae60',
  secret: '#2980b9',
  confidential: '#8e44ad',
  top_secret: '#c0392b',
};

export const RETENTION_LABELS: Record<RetentionPeriod, string> = {
  permanent: '永久',
  '30yrs': '30年',
  '10yrs': '10年',
  '5yrs': '5年',
  '3yrs': '3年',
};

export const ARCHIVE_BOX_LABELS: Record<string, string> = {
  'box-contract': '合同档案盒',
  'box-invoice': '发票档案盒',
  'box-confidential': '保密档案盒',
  'box-meeting': '会议档案盒',
  'box-project': '项目档案盒',
};

export const GRADE_THRESHOLDS = [
  { grade: 'S', min: 95 },
  { grade: 'A', min: 85 },
  { grade: 'B', min: 75 },
  { grade: 'C', min: 60 },
  { grade: 'D', min: 40 },
  { grade: 'F', min: 0 },
];