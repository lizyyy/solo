export type Severity = 'mild' | 'moderate' | 'severe';
export type AlertStatus = 'pending' | 'in_progress' | 'resolved' | 'follow_up';
export type TimelineEntryType =
  | 'judgment_created'
  | 'judgment_rerun'
  | 'note_added'
  | 'vaccine_photo_uploaded'
  | 'medication_changed'
  | 'material_supplemented'
  | 'status_updated';

export interface Pet {
  id: string;
  name: string;
  species: '犬' | '猫' | '其他';
  breed: string;
  age: number;
  ownerName: string;
  ownerPhone: string;
  avatarUrl: string;
}

export interface WeightRecord {
  id: string;
  petId: string;
  weighDate: string;
  weightKg: number;
  bcs: number;
}

export interface VaccinePhoto {
  id: string;
  timelineEntryId: string;
  batchNumber: number;
  url: string;
  uploadTime: string;
  remark?: string;
}

export interface MedicationChange {
  id: string;
  timelineEntryId: string;
  drugName: string;
  oldDosage: string;
  newDosage: string;
  guidanceNote: string;
}

export interface TimelineEntry {
  id: string;
  alertId: string;
  createdAt: string;
  entryType: TimelineEntryType;
  operator: string;
  content: string;
  judgmentSnapshot: string;
  photos?: VaccinePhoto[];
  medication?: MedicationChange;
}

export interface Note {
  id: string;
  alertId: string;
  createdAt: string;
  author: string;
  content: string;
  isManual: boolean;
}

export interface AbnormalAlert {
  id: string;
  petId: string;
  alertDate: string;
  severity: Severity;
  weightLossPct: number;
  currentStatus: AlertStatus;
  judgmentVersion: number;
  judgmentSnapshot: string;
  isRead: boolean;
  assignedTo: string;
  pet?: Pet;
  weightRecords?: WeightRecord[];
  timeline?: TimelineEntry[];
  notes?: Note[];
  currentMedication?: {
    drugName: string;
    dosage: string;
    startDate: string;
  };
}

export interface FilterState {
  keyword: string;
  dateFrom: string;
  dateTo: string;
  severities: Severity[];
  statuses: AlertStatus[];
  assignedTo: string;
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  mild: '轻度',
  moderate: '中度',
  severe: '重度',
};

export const STATUS_LABEL: Record<AlertStatus, string> = {
  pending: '待处理',
  in_progress: '处理中',
  follow_up: '待回访',
  resolved: '已完成',
};

export const TIMELINE_LABEL: Record<TimelineEntryType, string> = {
  judgment_created: '异常判定创建',
  judgment_rerun: '重跑异常判断',
  note_added: '添加人工备注',
  vaccine_photo_uploaded: '上传疫苗本照片',
  medication_changed: '调整用药剂量',
  material_supplemented: '补录病历材料',
  status_updated: '更新处理状态',
};

export const DEFAULT_FILTER: FilterState = {
  keyword: '',
  dateFrom: '',
  dateTo: '',
  severities: [],
  statuses: [],
  assignedTo: '',
};

export const OPERATORS = ['阿宁', '阿芳', '李医生', '王医生'];
