export type ScheduleStatus = 'confirmed' | 'pending' | 'withdrawn' | 'draft';

export type ChangeType = 'create' | 'update' | 'withdraw' | 'confirm' | 'reject' | 'resubmit' | 'model_replace';

export interface ModelReplaceReason {
  oldModel: string;
  newModel: string;
  reason: string;
  reportedBy: string;
  reportedAt: string;
}

export interface ChangeHistoryItem {
  id: string;
  scheduleId: string;
  changeType: ChangeType;
  timestamp: string;
  operator: string;
  oldMaterial?: string;
  newMaterial?: string;
  oldRemark?: string;
  newRemark?: string;
  reason?: string;
}

export interface EvidenceItem {
  id: string;
  bizKey: string;
  type: 'photo' | 'doc' | 'report';
  name: string;
  location: string;
  url?: string;
  uploadedAt: string;
  confirmed: boolean;
}

export interface ScheduleVersion {
  id: string;
  version: number;
  pipelineNo: string;
  partName: string;
  partModel: string;
  planDate: string;
  alarmContent: string;
  manualRemark: string;
  submitter: string;
  submittedAt: string;
  status: ScheduleStatus;
  modelReplace?: ModelReplaceReason;
}

export interface ScheduleAggregate {
  bizKey: string;
  latest: ScheduleVersion;
  versions: ScheduleVersion[];
  changeHistory: ChangeHistoryItem[];
  evidences: EvidenceItem[];
  withdrawnCount: number;
}

export interface InspectionCycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface MaterialLocation {
  id: string;
  partModel: string;
  warehouseZone: string;
  shelfNo: string;
  drawerNo: string;
  qrCodeUrl: string;
  contactPerson: string;
}

export interface DiffSpan {
  text: string;
  isDiff: boolean;
  side?: 'alarm' | 'remark';
}
