export type CollisionStatus =
  | 'PASSED'
  | 'PENDING_EVIDENCE'
  | 'REJECTED'
  | 'MANUAL_REJUDGED';

export interface Coordinate3D {
  x: number;
  y: number;
  z: number;
}

export interface ViewScreenshot {
  id: string;
  url: string;
  label: string;
  cameraPosition: Coordinate3D;
  targetPosition: Coordinate3D;
}

export type ClueStep = 'SAMPLE' | 'INITIAL_JUDGEMENT' | 'REVIEW' | 'CONCLUSION';

export interface ClueNode {
  id: string;
  step: ClueStep;
  title: string;
  description: string;
  evidenceUrls?: string[];
  operator: string;
  timestamp: string;
}

export interface HistoryRecord {
  id: string;
  collisionId: string;
  previousStatus: CollisionStatus;
  newStatus: CollisionStatus;
  reason: string;
  operator: string;
  timestamp: string;
  evidenceUrls?: string[];
}

export interface CollisionRecord {
  id: string;
  projectName: string;
  floor: string;
  nodeCode: string;
  collisionType: string;
  elementA: string;
  elementB: string;
  status: CollisionStatus;
  initialConclusion: string;
  screenshots: ViewScreenshot[];
  clueChain: ClueNode[];
  history: HistoryRecord[];
  isCoordinateOffset: boolean;
  coordinateOffsetNote?: string;
  rejudgeCount: number;
  responsiblePerson: string;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SummaryData {
  total: number;
  passed: number;
  pendingEvidence: number;
  manualRejudged: number;
  coordinateOffset: number;
}

export interface ListFilterParams {
  status?: CollisionStatus | 'ALL';
  coordinateOffsetOnly?: boolean;
  keyword?: string;
  project?: string;
  floor?: string;
}

export interface RejudgePayload {
  newStatus: CollisionStatus;
  reason: string;
  operator: string;
  evidenceUrls?: string[];
}

export const STATUS_LABEL: Record<CollisionStatus, string> = {
  PASSED: '已放行',
  PENDING_EVIDENCE: '待补证据',
  REJECTED: '驳回',
  MANUAL_REJUDGED: '人工改过',
};

export const STATUS_BG_CLASS: Record<CollisionStatus, string> = {
  PASSED: 'bg-status-passed',
  PENDING_EVIDENCE: 'bg-status-pending',
  REJECTED: 'bg-status-rejected',
  MANUAL_REJUDGED: 'bg-status-manual',
};

export const CLUE_STEP_LABEL: Record<ClueStep, string> = {
  SAMPLE: '样本提取',
  INITIAL_JUDGEMENT: '初判依据',
  REVIEW: '复核意见',
  CONCLUSION: '结论',
};
