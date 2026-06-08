export type WorkflowStage = 'initial_import' | 'alan_review' | 'classroom_demo';

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'needs_counterexample';

export type DisplayMode = 'list' | 'chart' | '3d';

export type RecordStatus = 'normal' | 'zero_denominator' | 'needs_review' | 'counterexample_provided' | 'demo_ready';

export type Stakeholder = 'data_reviewer' | 'alan' | 'system';

export interface ParameterVersion {
  version: string;
  timestamp: number;
  author: Stakeholder;
  parameters: CalculationParameters;
  reasoning: string;
}

export interface CalculationParameters {
  edgeWeightFormula: string;
  detourThreshold: number;
  considerTraffic: boolean;
  maxPathLength: number;
  allowUturn: boolean;
}

export interface ParameterRecord {
  id: string;
  batchId: string;
  importTimestamp: number;
  importHash: string;
  sourceNode: string;
  targetNode: string;
  numerator: number;
  denominator: number | null;
  denominatorDisplayEmpty: boolean;
  edgeWeight: number;
  remark: string;
  status: RecordStatus;
  reviewStatus: ReviewStatus;
  assignedTo: Stakeholder;
  versions: ParameterRecordVersion[];
  currentVersion: number;
  parameterVersionRef: string;
  manualCounterexample?: string;
  counterexampleProvider?: Stakeholder;
  counterexampleTimestamp?: number;
}

export interface ParameterRecordVersion {
  version: number;
  timestamp: number;
  author: Stakeholder;
  changes: Partial<ParameterRecord>;
  changeDescription: string;
}

export interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  z?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  traffic?: number;
}

export interface PathResult {
  nodes: string[];
  edges: string[];
  totalWeight: number;
}

export interface DetourComparisonResult {
  id: string;
  parameterRecordId: string;
  batchId: string;
  parameterVersion: ParameterVersion;
  shortestPath: PathResult;
  alternativePath: PathResult;
  detourRatio: number | null;
  detourDistance: number;
  isSignificantDetour: boolean;
  thresholdUsed: number;
  calculationTimestamp: number;
  explanation: {
    whyKept: string;
    missingMaterials: string[];
    nextAction: string;
    nextStakeholder: Stakeholder;
  };
  status: RecordStatus;
  classroomNote?: string;
  demoUpdated: boolean;
}

export interface HistoryDiff {
  fieldName: string;
  oldValue: unknown;
  newValue: unknown;
  changedAt: number;
  changedBy: Stakeholder;
}

export interface ReviewTask {
  id: string;
  parameterRecordId: string;
  assignedTo: Stakeholder;
  createdAt: number;
  completedAt?: number;
  status: ReviewStatus;
  comment?: string;
}

export interface AppState {
  parameterRecords: ParameterRecord[];
  comparisonResults: DetourComparisonResult[];
  reviewTasks: ReviewTask[];
  parameterVersions: ParameterVersion[];
  currentParameterVersion: string;
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  workflowStage: WorkflowStage;
  displayMode: DisplayMode;
  selectedRecordId: string | null;
  selectedResultId: string | null;
  currentUser: Stakeholder;
  showHistoryDiff: boolean;
  compareVersionFrom: number | null;
  compareVersionTo: number | null;
  lastImportStats?: {
    importedCount: number;
    duplicateCount: number;
    skippedCount: number;
    timestamp: number;
  };
  flowMessage?: {
    text: string;
    type: 'success' | 'info' | 'warning' | 'error';
    timestamp: number;
  };
}

export type AppAction =
  | { type: 'IMPORT_PARAMETER_RECORDS'; payload: ParameterRecord[] }
  | { type: 'UPDATE_PARAMETER_RECORD'; payload: { id: string; changes: Partial<ParameterRecord>; author: Stakeholder; description: string } }
  | { type: 'ADD_COMPARISON_RESULT'; payload: DetourComparisonResult }
  | { type: 'UPDATE_COMPARISON_RESULT'; payload: { id: string; changes: Partial<DetourComparisonResult> } }
  | { type: 'ADD_REVIEW_TASK'; payload: ReviewTask }
  | { type: 'UPDATE_REVIEW_TASK'; payload: { id: string; changes: Partial<ReviewTask> } }
  | { type: 'ADVANCE_WORKFLOW_STAGE' }
  | { type: 'SET_WORKFLOW_STAGE'; payload: WorkflowStage }
  | { type: 'SET_DISPLAY_MODE'; payload: DisplayMode }
  | { type: 'SELECT_RECORD'; payload: string | null }
  | { type: 'SELECT_RESULT'; payload: string | null }
  | { type: 'SET_CURRENT_USER'; payload: Stakeholder }
  | { type: 'ADD_PARAMETER_VERSION'; payload: ParameterVersion }
  | { type: 'SET_CURRENT_PARAMETER_VERSION'; payload: string }
  | { type: 'SHOW_HISTORY_DIFF'; payload: { recordId: string; fromVersion: number; toVersion: number } }
  | { type: 'HIDE_HISTORY_DIFF' }
  | { type: 'PROVIDE_COUNTEREXAMPLE'; payload: { recordId: string; counterexample: string; author: Stakeholder } }
  | { type: 'APPROVE_RECORD'; payload: { recordId: string; reviewer: Stakeholder; comment?: string } }
  | { type: 'REJECT_RECORD'; payload: { recordId: string; reviewer: Stakeholder; comment?: string } }
  | { type: 'UPDATE_CLASSROOM_NOTE'; payload: { resultId: string; note: string } }
  | { type: 'MARK_DEMO_UPDATED'; payload: { resultId: string } }
  | { type: 'RESET_ALL_DATA' }
  | { type: 'SET_IMPORT_STATS'; payload: { importedCount: number; duplicateCount: number; skippedCount: number } }
  | { type: 'SET_FLOW_MESSAGE'; payload: { text: string; type: 'success' | 'info' | 'warning' | 'error' } | null }
  | { type: 'RECALCULATE_EXPLANATIONS' }
  | { type: 'RUN_COMPARISON' }
  | { type: 'FLOW_STEP4_ADD_COUNTEREXAMPLE' }
  | { type: 'FLOW_STEP5_UPDATE_REMARK' }
  | { type: 'FLOW_STEP6_APPROVE_ALL' }
  | { type: 'FLOW_STEP7_SYNC_NOTES' }
  | { type: 'REMOVE_COMPARISON_RESULTS_BY_RECORD'; payload: string };
