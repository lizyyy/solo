export interface EnvConfig {
  [key: string]: string | number | boolean | undefined;
}

export interface Environment {
  name: string;
  alias?: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
}

export interface Snapshot {
  id: string;
  environment: string;
  data: EnvConfig;
  createdAt: string;
  comment?: string;
}

export interface ChangeRecord {
  id: string;
  environment: string;
  action: 'add' | 'update' | 'delete';
  key: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
  snapshotId: string;
}

export interface RiskRule {
  id: string;
  name: string;
  type: 'value-mismatch' | 'missing-key' | 'extra-key' | 'critical-key';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  enabled: boolean;
  config: {
    keyPattern?: string;
    expectedValue?: string;
    mustExist?: string[];
    environments?: string[];
  };
}

export interface RiskIssue {
  ruleId: string;
  ruleName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  environment?: string;
  affectedEnvironments?: string[];
  key?: string;
  details: any;
}

export interface DiffItem {
  key: string;
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  envA?: string | number | boolean;
  envB?: string | number | boolean;
  environmentA: string;
  environmentB: string;
}

export interface ProjectConfig {
  initialized: boolean;
  initializedAt: string;
  environments: Environment[];
  rules: RiskRule[];
  dataDir: string;
  cacheConfig: CacheConfig;
}

export interface CacheConfig {
  snapshotRetentionDays: number;
  historyRetentionDays: number;
  autoInvalidationEnabled: boolean;
}

export interface CacheInfo {
  snapshots: {
    total: number;
    byEnvironment: Record<string, number>;
    expired: number;
  };
  history: {
    total: number;
    byEnvironment: Record<string, number>;
    expired: number;
  };
  storageSize: number;
  lastInvalidatedAt?: string;
}
