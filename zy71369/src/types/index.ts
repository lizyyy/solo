export type BubbleStatus = 'PENDING' | 'NORMAL' | 'HAS_ISSUE' | 'FIXED' | 'CONFIRMED' | 'HISTORY';
export type IssueType = 'OVERLAP' | 'SPILL' | 'SEQUENCE';
export type IssueSeverity = 'WARNING' | 'ERROR';

export interface ComicPage {
  id: string;
  pageNumber: string;
  title: string;
  imageUrl: string;
  width: number;
  height: number;
  status: BubbleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Bubble {
  id: string;
  pageId: string;
  sequenceNumber: number;
  compositeKey: string;
  currentVersionId: string;
  latestVersion: number;
  hasConflict: boolean;
  status: BubbleStatus;
}

export interface BubbleVersion {
  id: string;
  bubbleId: string;
  version: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status: BubbleStatus;
  operator: string;
  createdAt: string;
  remark: string;
}

export interface Issue {
  id: string;
  bubbleId: string;
  relatedBubbleId?: string;
  type: IssueType;
  description: string;
  severity: IssueSeverity;
  status: 'OPEN' | 'RESOLVED';
  detectedAt: string;
  detectedBy: string;
}

export interface RevisionLog {
  id: string;
  versionId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  operator: string;
  operatedAt: string;
}

export interface ReportRow {
  pageNumber: string;
  sequenceNumber: number;
  bubbleId: string;
  version: number;
  text: string;
  textLength: number;
  position: string;
  issues: string[];
  status: string;
  remark: string;
  lastModified: string;
}

export const STATUS_LABELS: Record<BubbleStatus, string> = {
  PENDING: '待检测',
  NORMAL: '正常',
  HAS_ISSUE: '有问题',
  FIXED: '已修复',
  CONFIRMED: '已确认',
  HISTORY: '历史版本',
};

export const STATUS_COLORS: Record<BubbleStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-300',
  NORMAL: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  HAS_ISSUE: 'bg-red-100 text-red-800 border-red-300',
  FIXED: 'bg-sky-100 text-sky-800 border-sky-300',
  CONFIRMED: 'bg-slate-100 text-slate-800 border-slate-300',
  HISTORY: 'bg-stone-100 text-stone-500 border-stone-300',
};

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  OVERLAP: '气泡重叠',
  SPILL: '台词溢出',
  SEQUENCE: '顺序错误',
};

export const ISSUE_TYPE_COLORS: Record<IssueType, string> = {
  OVERLAP: 'bg-red-50 text-red-700 border-red-200',
  SPILL: 'bg-amber-50 text-amber-700 border-amber-200',
  SEQUENCE: 'bg-orange-50 text-orange-700 border-orange-200',
};
