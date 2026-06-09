// 异宠温控报告导出 - 核心类型定义

export type PetCategory = 'reptile' | 'bird' | 'smallMammal' | 'other';
export const PET_CATEGORY_LABEL: Record<PetCategory, string> = {
  reptile: '爬行类',
  bird: '鸟类',
  smallMammal: '小型哺乳',
  other: '其他',
};

export type WeightUnit = 'kg' | 'g' | '斤' | 'lb';

export type AnomalyType =
  | 'weight_unit_mixed'
  | 'duplicate_pet'
  | 'temp_out_of_range'
  | 'missing_data'
  | 'wechat_note_flag';

export const ANOMALY_LABEL: Record<AnomalyType, string> = {
  weight_unit_mixed: '体重单位混写',
  duplicate_pet: '疑似同宠异名',
  temp_out_of_range: '温度异常',
  missing_data: '字段缺失',
  wechat_note_flag: '微信备注含特殊标记',
};

export const ANOMALY_CHIP_CLASS: Record<AnomalyType, string> = {
  weight_unit_mixed: 'chip-anom-weight',
  duplicate_pet: 'chip-anom-dup',
  temp_out_of_range: 'chip-anom-temp',
  missing_data: 'chip-anom-miss',
  wechat_note_flag: 'chip-anom-wechat',
};

export type RecordStatus = 'pending' | 'confirmed' | 'anomaly';
export const STATUS_LABEL: Record<RecordStatus, string> = {
  pending: '待处理',
  confirmed: '已确认',
  anomaly: '异常',
};
export const STATUS_CHIP_CLASS: Record<RecordStatus, string> = {
  pending: 'chip-status-pending',
  confirmed: 'chip-status-confirmed',
  anomaly: 'chip-status-anomaly',
};

export interface JudgmentRecord {
  id: string;
  operator: string;
  originalAnomaly: AnomalyType;
  newStatus: RecordStatus;
  reason: string;
  timestamp: string;
}

export interface SupplementaryNote {
  id: string;
  author: string;
  content: string;
  timestamp: string;
}

export interface TempControlRecord {
  id: string;
  petName: string;
  petCategory: PetCategory;
  species: string;
  ownerName: string;
  ownerPhone: string;
  ownerWechatNote: string;
  weight: number;
  weightUnit: WeightUnit;
  weightNormalizedKg: number;
  weightUnitAbnormal: boolean;
  temperature: number;
  measureTime: string;
  status: RecordStatus;
  anomalyType: AnomalyType[];
  confirmedBy?: string;
  confirmedAt?: string;
  mergeGroupId?: string;
  aliases?: string[];
  judgments?: JudgmentRecord[];
  supplementaryNotes?: SupplementaryNote[];
}

export interface MergeGroup {
  id: string;
  primaryName: string;
  aliases: string[];
  mergedRecordIds: string[];
  ownerPhone: string;
  species: string;
  confirmed: boolean;
  confidence: number; // 0~1
  matchReasons: string[];
}

export interface MergeCandidate {
  groupId: string;
  recordIds: string[];
  confidence: number;
  matchReasons: string[];
}

export interface AnomalyQueueItem {
  recordId: string;
  anomalyTypes: AnomalyType[];
  resolved: boolean;
  addedAt: string;
}

export interface PersistedState {
  persistVersion: number;
  confirmedIds: string[];
  anomalyQueue: AnomalyQueueItem[];
  mergeGroups: MergeGroup[];
  judgmentsMap: Record<string, JudgmentRecord[]>;
  supplementaryMap: Record<string, SupplementaryNote[]>;
  statusOverrides: Record<string, RecordStatus>;
  lastSavedAt: string;
  lastOperator: string;
  lastAction: string;
}

export interface DrillDownState {
  type: AnomalyType | null;
  recordIds: string[];
  openedRecordId: string | null;
  highlightAt: number; // 时间戳，用于触发闪烁
}

export type FilterKey =
  | 'category'
  | 'status'
  | 'anomaly'
  | 'weightAbnormal'
  | 'hasDuplicate'
  | 'search';

export interface FilterState {
  category: PetCategory | 'all';
  status: RecordStatus | 'all';
  anomaly: AnomalyType | 'all';
  weightAbnormal: 'all' | 'abnormal' | 'normal';
  hasDuplicate: 'all' | 'yes' | 'no';
  search: string;
}

export type ExportField =
  | 'id'
  | 'petName'
  | 'aliases'
  | 'petCategory'
  | 'species'
  | 'ownerName'
  | 'ownerPhone'
  | 'weightRaw'
  | 'weightNormalized'
  | 'weightUnitFlag'
  | 'temperature'
  | 'measureTime'
  | 'status'
  | 'anomalyTags'
  | 'wechatNote'
  | 'judgments'
  | 'supplementaryNotes';

export interface ExportConfig {
  format: 'xlsx' | 'csv';
  fields: ExportField[];
  normalizeWeight: boolean;
  includeFlagColumns: boolean;
  onlyConfirmed: boolean;
}

export const EXPORT_FIELD_LABEL: Record<ExportField, string> = {
  id: '记录编号',
  petName: '宠物名',
  aliases: '曾用名/别名',
  petCategory: '宠物品类',
  species: '具体品种',
  ownerName: '主人姓名',
  ownerPhone: '联系电话',
  weightRaw: '体重(原始值+单位)',
  weightNormalized: '体重(规范化kg)',
  weightUnitFlag: '体重单位异常标记',
  temperature: '温度(℃)',
  measureTime: '测量时间',
  status: '处理状态',
  anomalyTags: '异常标签',
  wechatNote: '主人微信备注',
  judgments: '人工改判记录',
  supplementaryNotes: '后补说明',
};

// 主人微信备注里的现场痕迹关键词
export const WECHAT_TRACE_KEYWORDS: string[] = [
  '昨天', '今天', '刚到', '路上', '家里', '笼子里', '出门前',
  '到医院', '昨天还正常', '有点蔫', '没吃饭', '刚测',
  '昨天量的', '自己测的', '小区门口', '空调房',
];
