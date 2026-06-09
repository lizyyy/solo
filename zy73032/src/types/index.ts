export type Species = "狗" | "猫" | "其他";
export type Gender = "公" | "母" | "未知";
export type SourceType = "CSV" | "MEDICAL_FORM";
export type ScheduleStatus =
  | "PENDING"
  | "CONFIRMED"
  | "WITHDRAWN"
  | "ANOMALY";
export type LogAction =
  | "CONFIRM"
  | "WITHDRAW"
  | "BIND_ALIAS"
  | "RESOLVE_ANOMALY"
  | "IMPORT_CSV"
  | "IMPORT_MEDICAL";
export type LogTarget = "SCHEDULE" | "ALIAS" | "PET" | "SOURCE";
export type AliasSource = "CSV_COLUMN" | "MANUAL" | "MEDICAL_FORM";

export interface Pet {
  id: string;
  canonicalName: string;
  species: Species;
  gender: Gender;
  notes?: string;
  createdAt: string;
}

export interface PetAlias {
  id: string;
  petId: string | null;
  aliasName: string;
  source: AliasSource;
  linkedRecordId?: string;
  createdAt: string;
}

export interface DataSource {
  id: string;
  type: SourceType;
  fileName: string;
  importedBy: string;
  importedAt: string;
  note?: string;
}

export interface Schedule {
  id: string;
  petName: string;
  petId: string | null;
  courseName: string;
  courseDate: string;
  durationMin: number;
  trainer: string;
  status: ScheduleStatus;
  sourceId: string;
  sourceRow: string;
  confirmedAt?: string;
  withdrawnAt?: string;
  confirmedBy?: string;
  anomalyReason?: string;
}

export interface MedicalRecord {
  id: string;
  petName: string;
  visitDate: string;
  diagnosis: string;
  treatment: string;
  veterinarian: string;
  sourceId: string;
  linkedScheduleId: string | null;
  createdAt: string;
}

export interface OperationLog {
  id: string;
  targetType: LogTarget;
  targetId: string;
  action: LogAction;
  operator: string;
  operatedAt: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  remark?: string;
}

export interface AliasConflict {
  aliasName: string;
  matchedPetIds: string[];
  sourceRecords: { type: SourceType; id: string; label: string }[];
  affectedScheduleIds: string[];
  affectedMedicalIds: string[];
}

export interface DiffChunk {
  key: string;
  before: unknown;
  after: unknown;
  changed: boolean;
}

export interface Stats {
  totalSchedules: number;
  totalMinutes: number;
  confirmedCount: number;
  pendingCount: number;
  anomalyCount: number;
  withdrawnCount: number;
  medicalCount: number;
  aliasConflictCount: number;
}

export const SCHEDULE_STATUS_LABEL: Record<ScheduleStatus, string> = {
  PENDING: "待确认",
  CONFIRMED: "已确认",
  WITHDRAWN: "已撤回",
  ANOMALY: "异常隔离",
};

export const LOG_ACTION_LABEL: Record<LogAction, string> = {
  CONFIRM: "确认排程",
  WITHDRAW: "撤回确认",
  BIND_ALIAS: "绑定宠物别名",
  RESOLVE_ANOMALY: "处理别名冲突",
  IMPORT_CSV: "导入CSV明细",
  IMPORT_MEDICAL: "录入病历手写单",
};
