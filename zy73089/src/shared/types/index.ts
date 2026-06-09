export type BatchStatus = 'draft' | 'normal' | 'issue' | 'hold';
export type RunType = 'first' | 'rerun';
export type MatchStatus = 'matched' | 'mismatched' | 'pending';
export type IssueType = 'coordinate_offset' | 'material_mismatch' | 'other';
export type ExportFormat = 'json' | 'csv';
export type ComponentType = 'beam' | 'column' | 'slab' | 'wall';

export interface Coordinate {
  x: number;
  y: number;
  z: number;
}

export interface VisaForm {
  visaFormId: string;
  visaNo: string;
  issueDate: string;
  componentId: string;
  rawContent: string;
  rawCoordinates: Coordinate;
  sourceFile: string;
  constructionStandard?: string;
}

export interface MaterialSubmission {
  materialId: string;
  batchNo: string;
  componentId: string;
  submitDate: string;
  materialName: string;
  specification: string;
  rawContent: string;
  sourceFile: string;
  constructionStandard?: string;
}

export interface IssueFlag {
  issueId: string;
  itemId: string;
  issueType: IssueType;
  description: string;
  sourceEvidence: string;
  holdReason: string;
  blocksFinalReport: boolean;
}

export interface ChecklistItem {
  itemId: string;
  batchId: string;
  componentId: string;
  visaFormId: string | null;
  materialId: string | null;
  constructionStandard: string;
  matchStatus: MatchStatus;
  remarks: string;
}

export interface Batch {
  batchId: string;
  parentBatchId: string | null;
  name: string;
  status: BatchStatus;
  runType: RunType;
  createdAt: string;
  remark: string;
  items: ChecklistItem[];
  issues: IssueFlag[];
}

export interface BatchSnapshot {
  snapshotId: string;
  batchId: string;
  createdAt: string;
  data: Batch;
  exportFormat: ExportFormat;
}

export interface ModelComponent {
  id: string;
  name: string;
  type: ComponentType;
  position: Coordinate;
  size: Coordinate;
  color: string;
}

export interface FilterState {
  componentIds: string[];
  visaNos: string[];
  materialBatchNos: string[];
  statuses: MatchStatus[];
  dateRange: [string, string] | null;
}

export interface HistoryEvent {
  eventId: string;
  batchId: string;
  timestamp: string;
  eventType: 'batch_created' | 'batch_run' | 'batch_rerun' | 'snapshot_created' | 'remark_added';
  description: string;
}

export interface SampleData {
  visaForms: VisaForm[];
  materialSubmissions: MaterialSubmission[];
  modelComponents: ModelComponent[];
  expectedIssues: string[];
}
