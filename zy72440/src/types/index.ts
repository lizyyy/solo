export type RecordStatus = 'normal' | 'pending_review' | 'supplementary' | 'completed';

export type ProcessStep = 'import' | 'review_jietlong' | 'update_verification';

export type DemoType = 'smooth' | 'missing_region' | 'supplementary';

export interface OperationLog {
  id: string;
  timestamp: string;
  operator: string;
  action: string;
  description: string;
  step: ProcessStep;
}

export interface AuthorizedRegion {
  city: string;
  isMissing?: boolean;
}

export interface VerificationOrder {
  id: string;
  orderNo: string;
  recordId: string;
  quantity: number;
  amount: number;
  status: 'matched' | 'mismatch' | 'pending';
  mismatchReason?: string;
  createdAt: string;
}

export interface InventoryRecord {
  id: string;
  artistName: string;
  merchandise: string;
  quantity: number;
  authorizedRegions: AuthorizedRegion[];
  status: RecordStatus;
  currentStep: ProcessStep;
  isDemo: boolean;
  demoType?: DemoType;
  
  tunerMessage: string;
  groupJietlong?: string;
  hasSupplementary: boolean;
  supplementaryNote?: string;
  
  verificationOrder?: VerificationOrder;
  operationLogs: OperationLog[];
  
  createdAt: string;
  updatedAt: string;
}

export interface StatisticsData {
  total: number;
  normal: number;
  pendingReview: number;
  supplementary: number;
  completed: number;
}
