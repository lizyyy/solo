export type RecordStatus = 'pending' | 'processing' | 'completed' | 'withdrawn' | 'delayed';

export type RecordSource = 'on-site' | 'change-order' | 'withdrawal' | 'old-material';

export interface NoteRecord {
  id: string;
  content: string;
  createdAt: string;
  author: string;
}

export interface ScreenshotRecord {
  id: string;
  url: string;
  description: string;
  uploadedAt: string;
  uploader: string;
}

export interface TrackingRecord {
  id: string;
  recordNo: string;
  title: string;
  building: string;
  status: RecordStatus;
  source: RecordSource;
  createdAt: string;
  updatedAt: string;
  currentConclusion: string;
  isAbnormal: boolean;
  abnormalReason?: string;
  conclusionChangeReason?: string;
  relatedRecords: string[];
  withdrawalRecordId?: string;
  notes: NoteRecord[];
  screenshots: ScreenshotRecord[];
  changeOrderDueDate?: string;
  nextStepSuggestion?: string;
  handler?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface FilterState {
  status: RecordStatus | 'all';
  source: RecordSource | 'all';
  building: string;
  keyword: string;
  isAbnormal: boolean | 'all';
}

export interface PendingSummary {
  total: number;
  highPriority: number;
  delayed: number;
  abnormal: number;
}
