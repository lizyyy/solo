export interface ReleaseRequest {
  _id: string;
  requestId: string;
  title: string;
  description: string;
  applicant: string;
  department: string;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'rolled_back';
  priority: 'low' | 'medium' | 'high' | 'critical';
  type: 'config' | 'resource' | 'code' | 'database';
  changeHistory: Array<{
    field: string;
    oldValue: any;
    newValue: any;
    modifiedBy: string;
    modifiedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AffectedService {
  _id: string;
  requestId: string;
  serviceName: string;
  serviceId: string;
  environment: 'dev' | 'test' | 'staging' | 'prod';
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
  expectedDowntime: number;
  actualDowntime?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  changeHistory?: any[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ApprovalOpinion {
  _id: string;
  requestId: string;
  approver: string;
  approverRole: string;
  opinion: 'approved' | 'rejected' | 'need_modification';
  comments: string;
  approvalTime: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface GrayBatch {
  _id: string;
  requestId: string;
  batchNumber: number;
  batchName: string;
  targetPercentage: number;
  actualPercentage?: number;
  startTime?: Date;
  endTime?: Date;
  status: 'pending' | 'processing' | 'completed' | 'paused' | 'failed';
  instanceCount: number;
  successCount?: number;
  failedCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RollbackAction {
  _id: string;
  requestId: string;
  triggeredBy: string;
  triggerTime: Date;
  reason: string;
  reasonCategory: string;
  affectedBatches: string[];
  rollbackScope: 'partial' | 'full';
  status: string;
  startTime?: Date;
  endTime?: Date;
  rollbackDetails: Array<{
    serviceName: string;
    beforeVersion: string;
    afterVersion: string;
    status: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReleaseReport {
  _id: string;
  requestId: string;
  reportId: string;
  generatedBy: string;
  generatedAt: Date;
  overallStatus: 'success' | 'partial_success' | 'failed' | 'rolled_back';
  totalServices: number;
  successfulServices: number;
  failedServices: number;
  totalDowntime: number;
  maxDowntime: number;
  approvalSummary: {
    approverCount: number;
    approvedCount: number;
    rejectedCount: number;
  };
  grayBatchSummary: Array<{
    batchName: string;
    targetPercentage: number;
    actualPercentage: number;
    status: string;
    successRate: number;
  }>;
  rollbackSummary?: {
    hasRollback: boolean;
    rollbackReason: string;
    rollbackScope: string;
    affectedBatches: number;
  };
  exceptions: Array<{
    serviceName: string;
    errorType: string;
    errorMessage: string;
    occurredAt: Date;
    resolved: boolean;
    resolvedAt?: Date;
    resolver?: string;
    beforeValue?: any;
    afterValue?: any;
  }>;
  responsiblePerson: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  createdAt: Date;
  updatedAt: Date;
}
