export type ConflictStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';
export type AssigneeRole = 'operator' | 'annotator' | 'product';
export type ReviewStatus = 'open' | 'in_progress' | 'completed';

export interface Conflict {
  id: string;
  sampleNumber: string;
  modelVersion: string;
  previousModelVersion?: string;
  labelA: string;
  labelB: string;
  confidenceA: number;
  confidenceB: number;
  status: ConflictStatus;
  sourceUrl: string;
  ticketUrl?: string;
  currentRemark?: string;
  isModelVersionChanged: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RemarkHistory {
  id: string;
  conflictId: string;
  oldRemark: string;
  newRemark: string;
  operator: string;
  operatorRole: AssigneeRole;
  createdAt: string;
}

export interface Review {
  id: string;
  conflictId: string;
  reason: string;
  existingMaterials: string[];
  missingMaterials: string[];
  nextStep: string;
  assignee: AssigneeRole;
  assigneeName: string;
  dueDate?: string;
  status: ReviewStatus;
}

export interface ModelParams {
  id: string;
  conflictId: string;
  modelVersion: string;
  parameters: Record<string, any>;
  decisionReason: string;
}

export interface KnowledgeLink {
  id: string;
  url: string;
  sampleNumber: string;
  modelVersion: string;
  importedAt: string;
  importBatch: string;
}

export interface TrendData {
  date: string;
  count: number;
  modelChanged: number;
}
