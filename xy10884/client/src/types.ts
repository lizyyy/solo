export type DeviceStatus = 'online' | 'offline' | 'unknown';
export type RenewalStatus = 'pending' | 'success' | 'failed' | 'revoking' | 'revoked' | 'revoke_failed' | 'compensating' | 'compensated';
export type DeviceGroup = 'factory-a' | 'factory-b' | 'warehouse' | 'retail' | 'logistics';
export type BatchStatus = 'created' | 'processing' | 'completed' | 'partial';

export interface Device {
  id: string;
  name: string;
  group: DeviceGroup;
  status: DeviceStatus;
  currentCertExpiry: string;
  ipAddress: string;
  location: string;
}

export interface RenewalRecord {
  deviceId: string;
  status: RenewalStatus;
  newCertSn?: string;
  oldCertSn: string;
  issuedAt?: string;
  issueReceipt?: string;
  issueError?: string;
  revokedAt?: string;
  revokeReceipt?: string;
  revokeError?: string;
}

export interface CompensationAttempt {
  id: string;
  deviceId: string;
  operator: string;
  attemptedAt: string;
  status: 'success' | 'failed';
  errorMessage?: string;
}

export interface RenewalBatch {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  status: BatchStatus;
  deviceGroups: DeviceGroup[];
  expiryThresholdDays: number;
  totalDevices: number;
  records: RenewalRecord[];
  compensationAttempts: CompensationAttempt[];
}

export interface DeviceGroupInfo {
  id: string;
  name: string;
  count: number;
}