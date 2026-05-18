export enum ExtensionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
  EXPIRED = 'expired'
}

export interface DeprecationExtension {
  id: string;
  apiName: string;
  apiPath: string;
  caller: string;
  originalDeprecationDate: string;
  extendedDeprecationDate: string;
  reason: string;
  contactPerson: string;
  contactEmail: string;
  status: ExtensionStatus;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  syncStatus: 'synced' | 'pending' | 'failed';
  syncMessage?: string;
  syncAt?: string;
}

export interface CreateExtensionRequest {
  apiName: string;
  apiPath: string;
  caller: string;
  originalDeprecationDate: string;
  extendedDeprecationDate: string;
  reason: string;
  contactPerson: string;
  contactEmail: string;
}

export interface ApproveExtensionRequest {
  approvedBy: string;
  approvalComment?: string;
}

export interface SyncCheckResult {
  extensionId: string;
  apiPath: string;
  caller: string;
  extendedDeprecationDate: string;
  syncStatus: 'synced' | 'unsynced' | 'unknown';
  ruleExists: boolean;
  ruleDateMatches: boolean;
}

export type ExportFormat = 'json' | 'csv';
