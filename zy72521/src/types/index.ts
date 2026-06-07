export type RecordStatus = 'normal' | 'pending_review' | 'supplemented';

export type ActionType = 
  | 'import_prompt' 
  | 'auto_link_kb' 
  | 'generate_export' 
  | 'detect_phone_leak' 
  | 'pending_algorithm_review' 
  | 'kb_missing' 
  | 'supplement_kb' 
  | 'rerun_export' 
  | 'algorithm_review' 
  | 'fix_complete'
  | 'mark_supplemented';

export interface HistoryEntry {
  id: string;
  action: ActionType;
  operator: string;
  description: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
}

export interface CopyrightRecord {
  id: string;
  materialName: string;
  promptVersion: string;
  status: RecordStatus;
  knowledgeBaseLink: string;
  knowledgeBaseSource: string;
  exportContent: string;
  hasPhoneLeak: boolean;
  leakedPhone?: string;
  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
}

export const STATUS_CONFIG: Record<RecordStatus, StatusConfig> = {
  normal: {
    label: '正常',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50 border-emerald-200',
  },
  pending_review: {
    label: '待算法复核',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 border-amber-200',
  },
  supplemented: {
    label: '已补录',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200',
  },
};
