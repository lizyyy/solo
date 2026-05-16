export interface OfflineMemberRenewal {
  id: string;
  batchId: string;
  memberId: string;
  memberName: string;
  phoneNumber: string;
  originalPlan: string;
  renewedPlan: string;
  renewalAmount: number;
  paymentMethod: string;
  transactionId: string;
  operatorId: string;
  operatorName: string;
  renewalDate: string;
  effectiveDate: string;
  expiryDate: string;
  storeId: string;
  storeName: string;
  riskType: string;
  riskLevel: string;
  isWhitelisted: boolean;
  whitelistExpiry?: string;
  whitelistOperator?: string;
  whitelistReason?: string;
  labSampleId?: string;
  labNotes?: string;
  rawInput: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface BuildArtifact {
  id: string;
  artifactName: string;
  version: string;
  buildNumber: string;
  checksum: string;
  signature: string;
  signer: string;
  signedAt: string;
  buildDate: string;
  commitHash: string;
  branch: string;
  buildAgent: string;
  metadata: Record<string, any>;
}

export interface WhitelistRecord {
  id: string;
  memberId: string;
  memberName: string;
  reason: string;
  operatorId: string;
  operatorName: string;
  createdAt: string;
  expiryDate: string;
  isRevoked: boolean;
  revokedAt?: string;
  revokedBy?: string;
  revokeReason?: string;
  batchId: string;
}

export interface LabSample {
  id: string;
  sampleCode: string;
  batchId: string;
  memberId?: string;
  sampleType: string;
  collectionDate: string;
  collectionSite: string;
  collector: string;
  tester: string;
  testResult: string;
  testDate?: string;
  manualNotes: string;
  reviewer?: string;
  reviewDate?: string;
  requester: string;
  status: string;
  createdAt: string;
}

export interface AbnormalSample {
  id: string;
  sourceType: 'renewal' | 'whitelist' | 'lab';
  sourceId: string;
  batchId: string;
  riskType: string;
  riskLevel: string;
  description: string;
  detectedAt: string;
  detectedBy: string;
  status: 'pending' | 'reviewed' | 'resolved';
  assignee?: string;
  exportStatus: 'not_exported' | 'exported';
  exportedAt?: string;
  notes?: string;
}

export interface QueryFilter {
  batchId?: string;
  operatorId?: string;
  operatorName?: string;
  riskType?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  requester?: string;
}
