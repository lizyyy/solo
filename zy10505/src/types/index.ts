export enum DeliveryBatchStatus {
  CREATED = 'CREATED',
  PACKAGES_UPLOADED = 'PACKAGES_UPLOADED',
  MANIFEST_VERIFIED = 'MANIFEST_VERIFIED',
  SIGNATURE_VERIFIED = 'SIGNATURE_VERIFIED',
  PATCH_ORDER_VERIFIED = 'PATCH_ORDER_VERIFIED',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  MANUALLY_FIXED = 'MANUALLY_FIXED'
}

export interface DeliveryPackage {
  id: string;
  batchId: string;
  name: string;
  version: string;
  size: number;
  md5: string;
  sha256: string;
  uploadTime: Date;
  verificationStatus: VerificationStatus;
}

export interface ManifestFile {
  id: string;
  batchId: string;
  fileName: string;
  content: string;
  uploadTime: Date;
  verificationStatus: VerificationStatus;
  expectedPackages: string[];
  missingPackages: string[];
  extraPackages: string[];
}

export interface SignatureResult {
  id: string;
  batchId: string;
  packageId: string;
  packageName: string;
  signature: string;
  publicKey: string;
  verificationTime: Date;
  verificationStatus: VerificationStatus;
  errorMessage?: string;
}

export interface PatchOrder {
  id: string;
  batchId: string;
  order: string[];
  dependencies: Record<string, string[]>;
  verificationStatus: VerificationStatus;
  circularDependencies: string[];
  missingDependencies: string[];
}

export interface VerificationError {
  id: string;
  batchId: string;
  errorType: string;
  errorMessage: string;
  originalInput: any;
  processingEvidence: any;
  occurredAt: Date;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolutionNote?: string;
}

export interface VerificationReport {
  id: string;
  batchId: string;
  generatedAt: Date;
  generatedBy: string;
  overallStatus: VerificationStatus;
  packageCount: number;
  manifestCheck: VerificationStatus;
  signatureCheck: VerificationStatus;
  patchOrderCheck: VerificationStatus;
  details: {
    packages: Array<{
      name: string;
      version: string;
      md5: string;
      signatureStatus: VerificationStatus;
    }>;
    manifest: {
      expected: number;
      found: number;
      missing: string[];
      extra: string[];
    };
    patchOrder: {
      order: string[];
      issues: string[];
    };
  };
  exportedContent?: string;
}

export interface DeliveryBatch {
  id: string;
  batchNo: string;
  name: string;
  description: string;
  customer: string;
  version: string;
  status: DeliveryBatchStatus;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  packages: DeliveryPackage[];
  manifest: ManifestFile | null;
  signatures: SignatureResult[];
  patchOrder: PatchOrder | null;
  errors: VerificationError[];
  reports: VerificationReport[];
}