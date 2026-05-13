export enum CertificateType {
  SSL = 'SSL',
  DOMAIN = 'DOMAIN',
  VENDOR = 'VENDOR',
  EMPLOYEE = 'EMPLOYEE'
}

export enum CertificateStatus {
  ACTIVE = 'ACTIVE',
  EXPIRING = 'EXPIRING',
  EXPIRED = 'EXPIRED',
  MERGED = 'MERGED'
}

export interface Certificate {
  id: string;
  name: string;
  type: CertificateType;
  domain?: string;
  issuer?: string;
  issueDate: string;
  expiryDate: string;
  serialNumber?: string;
  fingerprint?: string;
  description?: string;
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  department?: string;
  source: string;
  sourceFile?: string;
  status: CertificateStatus;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface Owner {
  id: string;
  name: string;
  email: string;
  department?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportSource {
  type: 'csv' | 'xlsx' | 'json';
  filePath: string;
  sourceName: string;
  mapping?: FieldMapping;
}

export interface FieldMapping {
  name?: string;
  type?: string;
  domain?: string;
  issuer?: string;
  issueDate?: string;
  expiryDate?: string;
  serialNumber?: string;
  fingerprint?: string;
  description?: string;
  ownerName?: string;
  ownerEmail?: string;
  department?: string;
}

export interface HistoryRecord {
  id: string;
  certificateId: string;
  action: string;
  details: string;
  timestamp: string;
  actor?: string;
}

export interface ReportConfig {
  expiryWindowDays: number[];
  includeTypes: CertificateType[];
  format: 'html' | 'csv' | 'json';
  outputPath?: string;
}

export interface CheckResult {
  id: string;
  type: 'DUPLICATE' | 'EXPIRING' | 'EXPIRED' | 'MISSING_OWNER' | 'INVALID_DATA';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  certificateIds: string[];
}
