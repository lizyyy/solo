export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type ReviewStatus = 
  | 'pending_review'
  | 'needs_knowledge_review'
  | 'confirmed'
  | 'rolled_back';

export type TraceStage = 'prompt_import' | 'knowledge_link' | 'manual_confirm';

export interface PromptVersion {
  id: string;
  version: string;
  importedAt: number;
  importedBy: string;
  description?: string;
}

export interface KnowledgeLink {
  id: string;
  promptVersionId: string;
  url: string;
  title: string;
  addedAt: number;
  addedBy: string;
}

export interface ProcessParamSample {
  id: string;
  promptVersionId: string;
  sampleKey: string;
  params: Record<string, number>;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  metrics: {
    avgIndex?: number;
    rawValue?: number;
  };
  isMaskedByAvg: boolean;
  status: ReviewStatus;
  remark?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ReviewHistory {
  id: string;
  sampleId: string;
  stage: TraceStage;
  action: string;
  operator: string;
  remark?: string;
  oldRemark?: string;
  newRemark?: string;
  timestamp: number;
}

export interface ModelVersion {
  id: string;
  version: string;
  promptVersionId: string;
  comparedAt: number;
  comparedBy: string;
  changeSummary?: string;
}

export interface ApiError {
  code: string;
  message: string;
  userMessage: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  warnings: string[];
}
