export interface ParamVersion {
  id: string;
  versionNo: number;
  remark: string;
  createdAt: string;
}

export type ParamChangeType = 'value' | 'unit' | 'both';

export interface ParamChange {
  id: string;
  versionNo: number;
  changeType: ParamChangeType;
  oldValue: string;
  newValue: string;
  oldUnit?: string | null;
  newUnit?: string | null;
  changedBy: string;
  changedAt: string;
  batchNo: string;
}

export interface ParamRow {
  id: string;
  key: string;
  value: string | null;
  unit: string | null;
  sourceRemark: string;
  version: number;
  isEmptySet: boolean;
  missingUnit: boolean;
  batchNo: string;
  changes: ParamChange[];
}

export interface ParamTable {
  id: string;
  name: string;
  currentVersion: number;
  versions: ParamVersion[];
  rows: ParamRow[];
}

export interface ParamSnapshotRow {
  key: string;
  value: string | null;
  unit: string | null;
  sourceRemark: string;
  isEmptySet: boolean;
  missingUnit: boolean;
  introducedAtVersion: number;
  lastChangedAtVersion: number;
  batchNo: string;
}

export type ParamSnapshot = Record<string, ParamSnapshotRow>;

export interface GraphNode {
  id: string;
  name: string;
  x?: number;
  y?: number;
  category?: number;
  affected?: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  affected?: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  path: string[];
  totalCost: number;
}

export interface ImpactNode {
  order: number;
  rule: string;
  ruleCode: 'R-001' | 'R-002' | 'R-003';
  ruleDescription: string;
  paramKey: string;
  paramSourceRemark: string;
  versionNo: number;
  batchNo: string;
  isPostSupplement: boolean;
  before: string;
  after: string;
  delta: string;
  deltaType: 'increase' | 'decrease' | 'change';
}

export interface DetailRow {
  id: string;
  segment: string;
  paramKey: string;
  baseValue: number | null;
  targetValue: number | null;
  unit: string | null;
  sourceRemark: string;
  introducedAtVersion: number;
  lastChangedAtVersion: number;
  onBasePath: boolean;
  onTargetPath: boolean;
  isValueChanged: boolean;
  isEmptySet: boolean;
  missingUnit: boolean;
  delta: number;
}

export interface ReviewResult {
  id: string;
  sampleId: string;
  baseVersion: number;
  targetVersion: number;
  graphBefore: GraphData;
  graphAfter: GraphData;
  aggregate: {
    targetSum: number;
    baseSum: number;
    diffSum: number;
    count: number;
    changedCount: number;
  };
  detailRows: DetailRow[];
  impactChain: ImpactNode[];
  conclusionChanged: boolean;
  pathChanged: boolean;
  calibreVerified: boolean;
  reviewedAt: string;
}

export interface BoundarySample {
  id: string;
  name: string;
  description: string;
  data: Record<string, number | string>;
  paramVersion: number;
  isExample: boolean;
  createdAt: string;
}

export interface ExceptionRecord {
  id: string;
  sampleId: string;
  sampleName: string;
  reason: string;
  impactSummary: string;
  baseVersion: number;
  targetVersion: number;
  pathBefore: string;
  pathAfter: string;
  status: 'pending' | 'reviewing' | 'resolved';
  severity: 'low' | 'medium' | 'high';
  paramVersion: number;
  createdAt: string;
  snapshotId?: string;
}

export interface FilterSnapshot {
  id: string;
  name: string;
  conditions: FilterConditions;
  exportedAt?: string;
  createdAt: string;
}

export interface FilterConditions {
  status?: string;
  severity?: string;
  paramVersion?: string;
  baseVersion?: string;
  targetVersion?: string;
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
}

export type PageKey = 'home' | 'params' | 'review' | 'exceptions' | 'samples';
