export interface WaterQualityReport {
  id: string;
  reportNo: string;
  stationName: string;
  dateRange: { start: string; end: string };
  conclusion: string;
  materials: MaterialInfo[];
  anomalies: AnomalySummary[];
}

export type MaterialType = 'sensor' | 'lab' | 'ship';
export type MaterialStatus = 'normal' | 'delayed' | 'updated';

export interface MaterialInfo {
  type: MaterialType;
  name: string;
  updateTime: string;
  status: MaterialStatus;
  recordCount: number;
}

export type AnomalyType = 'delayed' | 'duplicate' | 'manual';

export interface AnomalySummary {
  type: AnomalyType;
  count: number;
  description: string;
}

export interface SourceRow {
  tableName: string;
  rowNumber: number;
  columnName: string;
  originalValue: string;
  currentValue: string;
  remark?: string;
}

export interface DelayedRecord {
  id: string;
  materialType: 'lab' | 'ship';
  materialName: string;
  arriveTime: string;
  expectedTime: string;
  delayHours: number;
  impactDescription: string;
  originalConclusion: string;
  revisedConclusion: string;
  affectedIndicators: string[];
  sourceRows: SourceRow[];
}

export interface BottleData {
  bottleNo: string;
  collectTime: string;
  depth: string;
  indicators: Record<string, number | string>;
}

export interface DuplicateBottle {
  id: string;
  bottleNo: string;
  duplicateCount: number;
  affectedIndicators: string[];
  sourceRows: SourceRow[];
  impactScope: string;
  isManualChecked: boolean;
  checkTime?: string;
  checker?: string;
  originalBottleData: BottleData;
  currentBottleData: BottleData;
}

export interface ChangedJudgment {
  indicator: string;
  originalJudgment: string;
  newJudgment: string;
  reason: string;
}

export interface TempRemark {
  id: string;
  materialType: 'lab';
  content: string;
  addTime: string;
  addedBy: string;
  changedJudgments: ChangedJudgment[];
}

export interface TraceStep {
  step: number;
  name: string;
  description: string;
  time?: string;
}

export type AnomalyDetailType = 'delayed' | 'duplicate' | 'remark';

export interface AnomalyDetail {
  id: string;
  type: AnomalyDetailType;
  title: string;
  tracePath: TraceStep[];
  beforeData: Record<string, any>;
  afterData: Record<string, any>;
  sourceRows: SourceRow[];
  manualConfirm?: {
    operator: string;
    time: string;
    comment: string;
  };
}
