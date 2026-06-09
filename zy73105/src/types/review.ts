export type ConclusionStatus = 'confirmed' | 'pending-material' | 'returned' | 'draft';

export type FilterTab =
  | 'all'
  | 'confirmed'
  | 'pending-material'
  | 'returned'
  | 'late-attachment'
  | 'layer-issue';

export type ResolutionDirection = 'rename' | 'return' | 'hold';

export type ResolutionStatus = 'pending' | 'done';

export interface Attachment {
  id: string;
  fileName: string;
  fileNo: string;
  expectedDate: string;
  actualDate: string;
  isLate: boolean;
  lateDays?: number;
  impactOnConclusion: string;
}

export interface LayerIssue {
  id: string;
  messyLayerName: string;
  expectedStandard: string;
  confirmReason: string;
  resolutionDirection: ResolutionDirection;
  resolutionStatus: ResolutionStatus;
}

export interface ConclusionChange {
  id: string;
  changedAt: string;
  changedBy: string;
  fromStatus: ConclusionStatus;
  toStatus: ConclusionStatus;
  changeReason: string;
}

export interface CausalStep {
  id: string;
  date: string;
  title: string;
  description: string;
  impactNote: string;
  isLateStep?: boolean;
}

export interface ReviewRecord {
  id: string;
  projectName: string;
  drawingNo: string;
  submissionDate: string;
  reviewDate: string;
  reviewer: string;
  conclusionStatus: ConclusionStatus;
  currentOpinion: string;
  attachments: Attachment[];
  layerIssues: LayerIssue[];
  causalChain: CausalStep[];
  history: ConclusionChange[];
}
