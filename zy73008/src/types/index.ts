export type WeightUnit = 'kg' | 'lb' | 'jin';

export interface VaccineRecord {
  id: string;
  name: string;
  date: string;
  expireDate: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentNote?: string;
  attachmentArrivedLate?: boolean;
}

export type AnomalyTag =
  | 'late_attachment'
  | 'weight_unit_mixed'
  | 'conclusion_changed'
  | 'manual_confirm'
  | 'fuzzy_attachment';

export type Conclusion =
  | '待审核'
  | '疫苗合格 可寄养'
  | '疫苗缺失 需补打'
  | '资料不全 暂缓';

export type Operator = '小温' | '主人补录' | '系统自动' | '现场老师';

export interface Supplement {
  id: string;
  time: string;
  content: string;
  operator: Operator;
}

export interface SnapshotData {
  dogName: string;
  breed: string;
  gender: '公' | '母';
  age: string;
  weight: number;
  weightUnit: WeightUnit;
  ownerName: string;
  ownerPhone: string;
  vaccines: VaccineRecord[];
  supplements: Supplement[];
  conclusion: Conclusion;
}

export interface HistoryEntry {
  version: number;
  timestamp: string;
  operator: Operator;
  snapshot: SnapshotData;
  remark?: string;
  anomaly?: AnomalyTag;
  anomalyExplanation?: string;
}

export interface DogRecord {
  id: string;
  statusTag: 'normal' | 'supplement' | 'anomaly' | 'verdict';
  statusLabel: string;
  caseType: string;
  createdAt: string;
  currentConclusion: Conclusion;
  current: SnapshotData;
  supplements: Supplement[];
  vaccines: VaccineRecord[];
  versionHistory: HistoryEntry[];
  manualConfirm?: {
    before: number;
    after: number;
    confirmedBy: string;
    confirmedAt: string;
  };
  verdictChain?: Array<{
    version: number;
    fromConclusion: Conclusion;
    toConclusion: Conclusion;
    reason: string;
    materials: string[];
  }>;
}

export interface DiffItem {
  path: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
  kind: 'added' | 'removed' | 'changed';
}
