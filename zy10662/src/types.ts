export type ViolationStatus = 'pending' | 'confirmed' | 'dismissed' | 'archived';

export type OperationSource = 'manual' | 'api' | 'import' | 'system' | 'batch';

export interface ViolationFragment {
  id: string;
  roomId: string;
  roomName: string;
  anchorName: string;
  fragmentStartTime: number;
  fragmentEndTime: number;
  violationTag: string;
  violationDescription?: string;
  detectModel: string;
  confidence: number;
  status: ViolationStatus;
  reviewerId?: string;
  reviewerName?: string;
  reviewComment?: string;
  createdAt: number;
  updatedAt: number;
  hasConflict: boolean;
  conflictInfo?: string;
}

export interface ReviewHistory {
  id: string;
  fragmentId: string;
  operationType: string;
  operationSource: OperationSource;
  operatorId: string;
  operatorName: string;
  oldStatus?: ViolationStatus;
  newStatus?: ViolationStatus;
  comment?: string;
  changedFields?: string;
  createdAt: number;
}

export interface ConflictInfo {
  type: string;
  reason: string;
  overlappingRecords: {
    id: string;
    detectModel: string;
    violationTag: string;
    confidence: number;
  }[];
}
