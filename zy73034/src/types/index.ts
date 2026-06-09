export type EventType = 'import' | 'confirm' | 'revoke' | 'addendum' | 'rejudge';

export type Species = '狗' | '猫' | '其他';
export type TrainingProgress = '未开始' | '进行中' | '已完成' | '中止';
export type TrainingJudge = '合格' | '不合格' | '待评定';
export type EventSource = 'vaccine_photo' | 'owner_supplement' | 'manual' | 'reimport';

export interface PetProfile {
  name: string;
  aliases: string[];
  species: Species;
  breed: string;
  vaccineStatus: string;
  trainingProgress: TrainingProgress;
  trainingJudge: TrainingJudge;
  latestNote: string;
  photoUrls: string[];
  confirmed: boolean;
  revoked: boolean;
}

export interface BaseEvent {
  id: string;
  petId: string;
  type: EventType;
  timestamp: number;
  operator: string;
  source?: EventSource;
  note?: string;
  snapshotBefore: PetProfile;
  snapshotAfter: PetProfile;
}

export interface RejudgeEvent extends BaseEvent {
  type: 'rejudge';
  rejudgeReason: string;
  oldJudge: TrainingJudge;
  newJudge: TrainingJudge;
}

export type PetEvent = BaseEvent | RejudgeEvent;

export type AnomalyType =
  | 'alias_duplicate'
  | 'manual_rejudge'
  | 'pending_confirm'
  | 'conflict_history'
  | 'self_alias_duplicate';

export interface Anomaly {
  type: AnomalyType;
  message: string;
  relatedPetIds?: string[];
}

export interface DerivedPet extends PetProfile {
  petId: string;
  anomalies: Anomaly[];
  lastModifiedAt: number;
  eventCount: number;
}

export interface ExportDiff {
  petId: string;
  petName: string;
  rowIndex: number;
  field: string;
  fieldIndex: number;
  oldValue: string;
  newValue: string;
  reason: string;
  eventType: EventType;
  eventId: string;
  timestamp: number;
}

export interface ExportSummary {
  totalRows: number;
  anomalyRows: number;
  diffs: ExportDiff[];
  generatedAt: number;
}
