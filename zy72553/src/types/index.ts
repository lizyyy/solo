export interface OnlineExperimentBucket {
  id: string;
  name: string;
  bucketId: string;
  importTime: string;
  importBatchId: string;
  featureCount: number;
  entityCount: number;
  importedBy: string;
}

export interface NegativeSample {
  id: string;
  entityId: string;
  entityName: string;
  bucketId: string;
  featureMissing: boolean;
  missingFeatures: string[];
  defaultScoreUsed: boolean;
  defaultScore: number;
  actualScore?: number;
  reviewed: boolean;
  reviewedBy?: string;
  reviewTime?: string;
  reviewStatus?: 'pending' | 'approved' | 'rejected' | 'need_recheck';
  reviewNote?: string;
}

export interface VersionHistory {
  id: string;
  entityId: string;
  field: string;
  oldValue: string;
  newValue: string;
  modifiedBy: string;
  modifiedTime: string;
  changeReason?: string;
}

export interface ModelParams {
  version: string;
  modelName: string;
  threshold: number;
  embeddingDimension: number;
  graphLayers: number;
  tradeOffReason: string;
  updatedAt: string;
}

export interface ExplainableSummary {
  whyKept: string;
  missingMaterials: string[];
  nextOwner: 'recommend_owner' | 'data_scientist';
  actionRequired: string;
}

export interface EntityMergeRecord {
  id: string;
  entityA: string;
  entityB: string;
  mergedName: string;
  bucketIds: string[];
  mergeScore: number;
  isDefaultScore: boolean;
  status: 'pending' | 'reviewing' | 'confirmed' | 'rejected';
  createdBy: string;
  createdAt: string;
  remark: string;
  featureMissing: boolean;
  missingFeatures: string[];
  modelParams: ModelParams;
  summary: ExplainableSummary;
  versionHistory: VersionHistory[];
  negativeSampleIds: string[];
}

export type ViewMode = 'table' | 'chart' | '3d';

export type WorkflowStep = 'import_bucket' | 'review_negative' | 'update_summary' | 'completed';
