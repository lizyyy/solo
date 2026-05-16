export enum ContractStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  BLOCKED = 'blocked',
  REVOKED = 'revoked',
  COMPENSATED = 'compensated'
}

export enum VerifyResult {
  SUCCESS = 'success',
  FAILED = 'failed',
  PARTIAL = 'partial'
}

export interface Supplier {
  id: string;
  name: string;
  publicKey: string;
  signAlgorithm: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractVersion {
  id: string;
  supplierId: string;
  version: string;
  callbackUrl: string;
  expectedFields: string[];
  signHeaderName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CallbackSample {
  id: string;
  contractVersionId: string;
  supplierId: string;
  rawRequest: string;
  headers: Record<string, string>;
  body: Record<string, any>;
  receivedAt: Date;
}

export interface SignHeader {
  id: string;
  callbackSampleId: string;
  headerName: string;
  headerValue: string;
  algorithm: string;
  extractedAt: Date;
}

export interface FieldDiff {
  id: string;
  callbackSampleId: string;
  fieldName: string;
  expected: string;
  actual: string;
  diffType: 'missing' | 'type_mismatch' | 'value_mismatch' | 'extra';
  severity: 'error' | 'warning';
}

export interface VerificationConclusion {
  id: string;
  callbackSampleId: string;
  supplierId: string;
  contractVersionId: string;
  status: ContractStatus;
  signResult: VerifyResult;
  fieldResult: VerifyResult;
  overallResult: VerifyResult;
  rawInput: string;
  processingBasis: string;
  finalConclusion: string;
  errorMessage?: string;
  verifiedBy?: string;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSampleRequest {
  supplierId: string;
  contractVersionId: string;
  headers: Record<string, string>;
  body: Record<string, any>;
}

export interface VerifyResponse {
  success: boolean;
  conclusionId: string;
  status: ContractStatus;
  overallResult: VerifyResult;
  signResult: VerifyResult;
  fieldResult: VerifyResult;
  fieldDiffs: FieldDiff[];
  errorMessage?: string;
}

export interface AuditLog {
  id: string;
  conclusionId: string;
  action: string;
  operator: string;
  oldStatus?: ContractStatus;
  newStatus?: ContractStatus;
  remark?: string;
  createdAt: Date;
}
