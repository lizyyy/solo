export type Difficulty = 'easy' | 'medium' | 'hard';
export type SourceType = 'normal' | 'late' | 'manual';
export type ChainStatus = 'pending' | 'confirmed' | 'conflict';
export type NodeType = 'mistake_created' | 'snapshot_attached' | 'correction_made' | 'commentary_added' | 'conclusion_reached';

export interface StudentMistake {
  id: string;
  studentName: string;
  questionId: string;
  difficulty: Difficulty;
  originalImage: string;
  createdAt: string;
  source: SourceType;
  hasSnapshot: boolean;
}

export interface LectureSnapshot {
  id: string;
  questionId: string;
  imageUrl: string;
  uploader: string;
  uploadTime: string;
  isLate: boolean;
}

export interface ManualCorrection {
  id: string;
  mistakeId: string;
  operator: string;
  reason: string;
  beforeValue: string;
  afterValue: string;
  correctedAt: string;
}

export interface Commentary {
  id: string;
  mistakeId: string;
  content: string;
  author: string;
  createdAt: string;
}

export interface EvidenceRef {
  type: 'image' | 'text' | 'record';
  id: string;
  url?: string;
}

export interface TimelineNode {
  id: string;
  type: NodeType;
  title: string;
  description: string;
  operator: string;
  timestamp: string;
  evidenceRefs: EvidenceRef[];
}

export interface EvidenceChain {
  id: string;
  mistakeId: string;
  currentConclusion: string;
  status: ChainStatus;
  timeline: TimelineNode[];
  updatedAt: string;
  hasDuplicate: boolean;
  duplicateWith?: string;
  missingSnapshot: boolean;
}

export interface ImportPackage {
  mistakes: StudentMistake[];
  snapshots: LectureSnapshot[];
  corrections: ManualCorrection[];
  commentaries: Commentary[];
}

export interface ImportResult {
  success: boolean;
  total: number;
  normal: number;
  late: number;
  duplicates: string[];
  conflicts: string[];
  missingSnapshots: string[];
  chains: EvidenceChain[];
}

export interface FilterOptions {
  difficulty?: Difficulty;
  status?: ChainStatus;
  hasDuplicate?: boolean;
  missingSnapshot?: boolean;
  studentName?: string;
}
