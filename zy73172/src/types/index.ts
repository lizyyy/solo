export type AttributionType = 'concept' | 'calculation' | 'thinking' | 'reading';

export type RecordStatus = 'processed' | 'pending' | 'manual';

export interface KnowledgeNode {
  id: string;
  name: string;
  category: string;
  errorCount: number;
  attributionType: AttributionType;
  x: number;
  y: number;
}

export interface PathEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  weight: number;
}

export interface ErrorRecord {
  id: string;
  studentId: string;
  studentName: string;
  questionId: string;
  questionTitle: string;
  studentAnswer: string;
  correctAnswer: string;
  nodeId: string;
  status: RecordStatus;
  attribution: string;
  attributionType: AttributionType;
  note: string;
  createdAt: string;
  updatedAt: string;
  isWithdrawn: boolean;
  isDuplicate: boolean;
  duplicateReason: string;
}

export interface GraphData {
  nodes: KnowledgeNode[];
  edges: PathEdge[];
}

export interface RecordState {
  processed: ErrorRecord[];
  pending: ErrorRecord[];
  manual: ErrorRecord[];
}

export interface AppState {
  graph: GraphData;
  records: RecordState;
  selectedNodeId: string | null;
  selectedRecordId: string | null;
  lastRecalcTime: string | null;
  caliberCheckPassed: boolean;
}
