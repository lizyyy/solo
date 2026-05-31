export interface Classroom {
  id: string;
  name: string;
  createdAt: string;
  status: 'active' | 'archived';
}

export type RecordType = 'operation' | 'script' | 'note' | 'score';
export type MaterialType = 'supplement' | 'conclusion_change';
export type AnomalyType = 'normal' | 'view_reset' | 'misoperation' | 'other';

export interface Record {
  id: string;
  classroomId: string;
  type: RecordType;
  content: string;
  materialType: MaterialType;
  timestamp: string;
  operator: string;
  annotation?: Annotation;
}

export interface Annotation {
  id: string;
  recordId: string;
  anomalyType: AnomalyType;
  explanation: string;
  annotatedAt: string;
  annotator: string;
}

export interface ScoreSheet {
  id: string;
  classroomId: string;
  name: string;
  versions: ScoreSheetVersion[];
}

export interface ScoreSheetVersion {
  id: string;
  version: number;
  content: string;
  uploadedAt: string;
  uploader: string;
}

export interface ExportData {
  classroom: Classroom;
  records: Record[];
  scoreSheets: ScoreSheet[];
  exportedAt: string;
  version: string;
}

export interface ExportOptions {
  includeAnnotations: boolean;
  includeScoreSheets: boolean;
  includeSupplemental: boolean;
}

export interface DiffResult {
  type: 'added' | 'removed' | 'modified';
  line: number;
  content: string;
}

export interface CriticalChange {
  severity: 'high' | 'medium' | 'low';
  description: string;
  location: string;
}
