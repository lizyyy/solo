export type TrackStatus =
  | 'pending'
  | 'observing'
  | 'recovered'
  | 'transferred'
  | 'closed_normal'
  | 'closed_abnormal';

export type LitterIssueType =
  | 'odor'
  | 'usage'
  | 'appearance'
  | 'cleanliness'
  | 'other';

export type MaterialType =
  | 'medical_record'
  | 'attachment'
  | 'oral_note';

export interface Material {
  id: string;
  trackId: string;
  type: MaterialType;
  fileName: string;
  filePath: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
  version: number;
  replacedMaterialId?: string;
  summary: string;
  hasConsistencyChange: boolean;
  consistencyChangeNote?: string;
}

export interface Track {
  id: string;
  petName: string;
  aliases: string[];
  issueType: LitterIssueType;
  initialVisitDate: string;
  status: TrackStatus;
  abnormalReason?: string;
  currentNote: string;
  revisionCount: number;
  aliasWarning: boolean;
  createdAt: string;
  updatedAt: string;
  lastOperator: string;
  materials: Material[];
}

export interface Revision {
  id: string;
  trackId: string;
  version: number;
  oldStatus: TrackStatus | null;
  newStatus: TrackStatus;
  reviseReason: string;
  noteSnapshot: string;
  operator: string;
  createdAt: string;
  newMaterialIds: string[];
}

export interface TimelineNode {
  id: string;
  type: 'create' | 'revise' | 'upload';
  timestamp: string;
  operator: string;
  title: string;
  summary: string;
  details: {
    statusChange?: { old: TrackStatus | null; new: TrackStatus };
    reviseReason?: string;
    materials?: { id: string; name: string; version: number; changed?: boolean }[];
    note?: string;
  };
}

export const STATUS_LABEL: Record<TrackStatus, string> = {
  pending: '待回访',
  observing: '观察中',
  recovered: '已恢复',
  transferred: '已转医',
  closed_normal: '结案·正常',
  closed_abnormal: '结案·异常',
};

export const ISSUE_LABEL: Record<LitterIssueType, string> = {
  odor: '异味严重',
  usage: '使用异常',
  appearance: '外观异常',
  cleanliness: '清洁度异常',
  other: '其他',
};

export const MATERIAL_LABEL: Record<MaterialType, string> = {
  medical_record: '病历手写单',
  attachment: '附件',
  oral_note: '口头说明',
};
