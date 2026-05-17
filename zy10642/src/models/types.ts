export enum ReviewStatus {
  SCORED = '已评分',
  APPEALING = '复议中',
  SCORE_CHANGED = '已改分',
  MAINTAINED = '维持原分'
}

export interface DeductionItem {
  id: string;
  category: string;
  description: string;
  points: number;
  createdAt: Date;
}

export interface AppealMaterial {
  id: string;
  type: 'screenshot' | 'recording' | 'text';
  url?: string;
  content?: string;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface HistoryRecord {
  id: string;
  action: string;
  operatorId: string;
  operatorName: string;
  comment?: string;
  previousStatus?: ReviewStatus;
  newStatus?: ReviewStatus;
  previousScore?: number;
  newScore?: number;
  previousDeductions?: DeductionItem[];
  createdAt: Date;
}

export interface QualityReview {
  id: string;
  sessionId: string;
  customerServiceId: string;
  customerServiceName: string;
  inspectorId: string;
  inspectorName: string;
  originalScore: number;
  currentScore: number;
  deductions: DeductionItem[];
  status: ReviewStatus;
  appealReason?: string;
  appealMaterials: AppealMaterial[];
  reviewerId?: string;
  reviewerName?: string;
  reviewComment?: string;
  history: HistoryRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAppealRequest {
  reason: string;
  materials: Omit<AppealMaterial, 'id' | 'uploadedAt'>[];
}

export interface ReviewAppealRequest {
  action: 'approve' | 'reject';
  reviewerId: string;
  reviewerName: string;
  comment: string;
  newScore?: number;
  newDeductions?: DeductionItem[];
}
