export interface ScheduleBatch {
  batchId: string;
  createdAt: string;
  createdBy: string;
  status: 'draft' | 'pending_review' | 'overridden' | 'rerun' | 'exported';
  version: number;
  parentBatchId?: string;
  elevatorCount: number;
  itemCount: number;
  overrideCount: number;
  riskNote?: string;
}

export interface ScheduleItem {
  id: string;
  batchId: string;
  version: number;
  elevatorNo: string;
  faultCode: string;
  faultDescription: string;
  recommendedPartNo: string;
  recommendedPartName: string;
  recommendedQty: number;
  finalPartNo: string;
  finalPartName: string;
  finalQty: number;
  isOverridden: boolean;
  overrideId?: string;
  photoIds: string[];
  lateNote?: string;
  monthlyImpactBefore: number;
  monthlyImpactAfter: number;
}

export interface MaintenancePhoto {
  id: string;
  itemId: string;
  batchId: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
  supplementaryNote?: string;
  isSupplementary: boolean;
}

export interface OverrideRecord {
  id: string;
  itemId: string;
  batchId: string;
  createdAt: string;
  createdBy: string;
  reason: string;
  impactExplanation: string;
  before: { partNo: string; partName: string; qty: number };
  after: { partNo: string; partName: string; qty: number };
  impactChain: ImpactNode[];
}

export interface ImpactNode {
  id: string;
  level: 'override' | 'item' | 'part' | 'monthly_summary';
  label: string;
  detail: string;
  deltaValue?: number;
  childrenIds: string[];
}

export type ReplaceActionStatus = 'pending' | 'in_progress' | 'done' | 'blocked';

export interface ReplaceAction {
  id: string;
  overrideId: string;
  batchId: string;
  oldPartNo: string;
  oldPartName: string;
  newPartNo: string;
  newPartName: string;
  qty: number;
  targetWarehouse: string;
  assignee: string;
  dueDate: string;
  status: ReplaceActionStatus;
  blockingNote?: string;
}

export interface Snapshot {
  id: string;
  batchId: string;
  version: number;
  createdAt: string;
  trigger: 'initial' | 'override' | 'rerun';
  itemSnapshot: ScheduleItem[];
  continuityCheck: {
    hasGap: boolean;
    gapDetails?: string;
    missingItemIds: string[];
  };
}

export interface ScheduleListFilters {
  dateFrom?: string;
  dateTo?: string;
  elevatorNos?: string[];
  batchIds?: string[];
  isOverridden?: boolean;
  partNos?: string[];
  statuses?: ScheduleBatch['status'][];
}

export interface FilterSignaturePayload {
  signature: string;
  filters: ScheduleListFilters;
  matchedItemIds: string[];
  matchedBatchIds: string[];
  exportedAt: string;
}

export interface BatchWithItems extends ScheduleBatch {
  items: ScheduleItem[];
}
