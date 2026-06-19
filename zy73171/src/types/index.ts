export interface ParamVersion {
  id: string;
  versionNo: number;
  remark: string;
  createdAt: string;
}

export interface ParamChange {
  id: string;
  oldValue: string;
  newValue: string;
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
  ruleDescription: string;
  paramKey: string;
  before: string;
  after: string;
  delta: string;
  deltaType: 'increase' | 'decrease' | 'change';
}

export interface DetailRow {
  id: string;
  segment: string;
  chartValue: number;
  detailValue: number;
  diff: number;
  isDiff: boolean;
}

export interface ReviewResult {
  id: string;
  sampleId: string;
  graphBefore: GraphData;
  graphAfter: GraphData;
  chartAggregate: { sum: number; avg: number; count: number };
  detailRows: DetailRow[];
  calibreDiff: DetailRow[];
  impactChain: ImpactNode[];
  conclusionChanged: boolean;
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
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
}

export type PageKey = 'home' | 'params' | 'review' | 'exceptions' | 'samples';
