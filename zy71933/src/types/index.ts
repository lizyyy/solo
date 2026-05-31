export type MaterialStatus = 
  | 'pending'
  | 'approved' 
  | 'rejected'
  | 'needs_revision'
  | 'auth_expired';

export interface AuthorizationFile {
  id: string;
  name: string;
  uploadDate: string;
  expiryDate: string;
  uploadedBy: string;
  fileHash: string;
  notes?: string;
}

export interface ChangeRecord {
  field: string;
  oldValue: string;
  newValue: string;
}

export interface VersionHistory {
  version: number;
  timestamp: string;
  modifiedBy: string;
  changes: ChangeRecord[];
  comment: string;
  status: MaterialStatus;
}

export interface Material {
  id: string;
  name: string;
  source: string;
  currentStatus: MaterialStatus;
  statusReason: string;
  createdAt: string;
  createdBy: string;
  lastModifiedAt: string;
  lastModifiedBy: string;
  authorizationFiles: AuthorizationFile[];
  versionHistory: VersionHistory[];
  currentVersion: number;
  tags: string[];
  batchId: string;
  reviewComments: string;
}

export interface FilterOptions {
  status?: MaterialStatus;
  batchId?: string;
  source?: string;
  hasAuthExpired?: boolean;
}

export interface User {
  id: string;
  name: string;
}
