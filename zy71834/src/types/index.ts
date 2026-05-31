export type SourceType = 'normal' | 'late_attachment' | 'duplicate' | 'manual_correction';
export type AnomalyType = 'boundary_crossing' | 'report_mismatch' | 'turn_order_error';
export type ConfirmStatus = 'pending' | 'confirmed';
export type RecordStatus = 'valid' | 'duplicate' | 'superseded';

export interface MaterialPack {
  id: string;
  name: string;
  importedAt: Date;
  rawData: unknown;
  stats: {
    totalRecords: number;
    normalCount: number;
    lateCount: number;
    duplicateCount: number;
    manualCount: number;
    anomalyCount: number;
  };
}

export interface TestRecord {
  id: string;
  materialId: string;
  round: number;
  timestamp: Date;
  content: string;
  sourceType: SourceType;
  status: RecordStatus;
  anomalies: string[];
  linkedUnits: string[];
  linkedTerrain: string[];
  battleReport?: string;
  settlementData?: Record<string, unknown>;
  movementPath?: string[];
  duplicateOfId?: string;
  originalFile: string;
}

export interface UnitEntry {
  id: string;
  materialId: string;
  unitCode: string;
  unitName: string;
  stats: Record<string, number>;
  effectiveRound: number;
  source: string;
  isManualCorrection: boolean;
  replacesUnitId?: string;
}

export interface TerrainRule {
  id: string;
  gridPosition: string;
  ruleType: 'movement' | 'combat' | 'supply';
  description: string;
  effectiveRound: number;
  source: string;
  passable: boolean;
  movementCost?: number;
}

export interface Anomaly {
  id: string;
  recordId: string;
  type: AnomalyType;
  severity: 'warning' | 'critical';
  status: ConfirmStatus;
  confirmedBy?: string;
  confirmedAt?: Date;
  remark?: string;
  description: string;
  evidence: {
    expected: string;
    actual: string;
  };
}

export interface EvidenceChain {
  id: string;
  conclusion: string;
  nodeRefs: {
    testRecordId?: string;
    unitEntryId?: string;
    terrainRuleId?: string;
  }[];
  reviewReportId?: string;
}

export interface ReviewReport {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  linkedRecordIds: string[];
}

export interface ConfirmationLog {
  id: string;
  anomalyId: string;
  operator: string;
  timestamp: Date;
  action: 'confirm' | 'unconfirm' | 'add_remark';
  remark?: string;
}

export interface TimelineData {
  round: number;
  testRecords: TestRecord[];
  unitEntries: UnitEntry[];
  terrainRules: TerrainRule[];
  anomalies: Anomaly[];
}

export type HighlightState = {
  round: number | null;
  recordId: string | null;
};
