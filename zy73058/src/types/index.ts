export type ReviewStatus = 'confirmed' | 'pending' | 'rejected';
export type ChangeType = 'rename' | 'threshold' | 'supplement' | 'none';

export interface ChangeLogEntry {
  id: string;
  operator: string;
  changedAt: string;
  field: string;
  beforeValue: string;
  afterValue: string;
  impactExplanation: string;
  changeType: ChangeType;
}

export interface SparePart {
  id: string;
  name: string;
  spec: string;
  origin: string;
  batch: string;
  quantity: number;
}

export interface ReviewRecord {
  id: string;
  elevatorId: string;
  reporter: string;
  faultType: string;
  status: ReviewStatus;
  handler: string;
  reportedAt: string;
  handledAt: string;
  changeLogs: ChangeLogEntry[];
  rawSnapshot: {
    spareParts: SparePart[];
    notes: string;
  };
  sparePartIds: string[];
  hasThresholdAdjustment: boolean;
  summary: string;
  thresholdInfo?: {
    field: string;
    oldThreshold: string;
    newThreshold: string;
    triggeredMisses: number;
  };
}
