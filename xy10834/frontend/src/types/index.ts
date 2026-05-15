export enum ConfigStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  DEPRECATED = 'DEPRECATED',
}

export enum InstanceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  UNHEALTHY = 'UNHEALTHY',
}

export enum PullStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
  TIMEOUT = 'TIMEOUT',
}

export enum EffectiveStatus {
  EFFECTIVE = 'EFFECTIVE',
  NOT_EFFECTIVE = 'NOT_EFFECTIVE',
  PARTIAL = 'PARTIAL',
  UNKNOWN = 'UNKNOWN',
}

export enum CompensateStatus {
  NOT_NEEDED = 'NOT_NEEDED',
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface ConfigItem {
  id: string;
  key: string;
  value: string;
  description?: string;
  status: ConfigStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface ServiceInstance {
  id: string;
  instanceId: string;
  serviceName: string;
  ipAddress: string;
  hostname?: string;
  env: string;
  status: InstanceStatus;
  lastHeartbeat: string;
  createdAt: string;
  updatedAt: string;
}

export interface DistributionVersion {
  id: string;
  configId: string;
  version: number;
  releasedBy?: string;
  releaseNote?: string;
  isForce: boolean;
  releasedAt: string;
  createdAt: string;
}

export interface PullRecord {
  id: string;
  configId: string;
  instanceId: string;
  distributionId?: string;
  requestedVersion: number;
  actualVersion?: number;
  pullStatus: PullStatus;
  errorMessage?: string;
  retryCount: number;
  pulledAt: string;
  nextRetryAt?: string;
}

export interface EffectiveState {
  id: string;
  configId: string;
  instanceId: string;
  currentVersion: number;
  effectiveStatus: EffectiveStatus;
  checkedAt: string;
  lastConfirmedAt?: string;
  compensatedAt?: string;
  compensateStatus: CompensateStatus;
  compensateNote?: string;
}

export interface DiffReport {
  id: string;
  configId: string;
  baseVersion: number;
  targetVersion: number;
  diffContent: string;
  affectedInstances: number;
  generatedBy?: string;
  generatedAt: string;
  exportedAt?: string;
}

export interface Statistics {
  config: {
    total: number;
    published: number;
    draft: number;
  };
  instance: {
    total: number;
    online: number;
    offline: number;
  };
  pull: {
    total: number;
    success: number;
    failed: number;
    pending: number;
    timeout: number;
  };
  effective: {
    total: number;
    effective: number;
    notEffective: number;
    partial: number;
    unknown: number;
  };
  compensate: {
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
    failed: number;
    notNeeded: number;
  };
  oldValueCount: number;
  recentVersions: DistributionVersion[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}
