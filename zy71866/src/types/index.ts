export type SourceType = 'normal' | 'late' | 'correction';

export type FlagType = 
  | 'equivalent_answer_mismatch'
  | 'empty_set_boundary'
  | 'step_scoring_bias';

export type StatusType = 'normal' | 'pending' | 'warning';

export type AttachmentType = 'image' | 'pdf' | 'screenshot';

export type EvidenceType = 'student_answer' | 'standard_answer' | 'screenshot' | 'correction_note';

export interface Attachment {
  id: string;
  type: AttachmentType;
  name: string;
  url: string;
  isLate: boolean;
  timestamp: string;
}

export interface Correction {
  id: string;
  recordId: string;
  field: 'answer' | 'score' | 'status';
  before: string | number;
  after: string | number;
  operator: string;
  reason: string;
  timestamp: string;
}

export interface Record {
  id: string;
  studentId: string;
  studentName: string;
  questionId: string;
  questionTitle: string;
  knowledgePoint: string;
  studentAnswer: string;
  standardAnswer: string;
  score: number;
  fullScore: number;
  source: SourceType;
  isDuplicate: boolean;
  duplicateOf?: string;
  attachments: Attachment[];
  corrections: Correction[];
  createdAt: string;
}

export interface Flag {
  type: FlagType;
  description: string;
  confidence: number;
}

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  content: string;
  url?: string;
  timestamp: string;
}

export interface MatrixPosition {
  knowledgePoint: string;
  errorType: string;
}

export interface AnalysisResult {
  id: string;
  recordId: string;
  status: StatusType;
  flags: Flag[];
  matrixPosition: MatrixPosition;
  evidenceChain: EvidenceItem[];
}

export interface MatrixCell {
  knowledgePoint: string;
  errorType: string;
  count: number;
  recordIds: string[];
  status: StatusType;
}

export interface MaterialPack {
  id: string;
  name: string;
  records: Record[];
  version: number;
  createdAt: string;
}

export interface VersionInfo {
  id: string;
  packId: string;
  version: number;
  timestamp: string;
  changes: string[];
}

export interface ChangeItem {
  type: 'added' | 'removed' | 'modified';
  recordId: string;
  field?: string;
  oldValue?: any;
  newValue?: any;
}
