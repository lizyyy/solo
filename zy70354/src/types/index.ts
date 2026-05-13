export enum ShardRuleType {
  MONTHLY = 'monthly',
  TENANT_HASH = 'tenant_hash',
  CUSTOM = 'custom',
}

export enum MigrationStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ROLLING_BACK = 'rolling_back',
}

export enum WriteStrategy {
  NEW_ONLY = 'new_only',
  DUAL_WRITE = 'dual_write',
  OLD_ONLY = 'old_only',
}

export enum ReadStrategy {
  NEW_ONLY = 'new_only',
  DUAL_READ = 'dual_read',
  OLD_ONLY = 'old_only',
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  poolSize?: number;
}

export interface ShardConfig {
  shardId: string;
  database: string;
  table: string;
  dbConfig: DatabaseConfig;
  isHistorical: boolean;
  createdAt: string;
  deprecated?: boolean;
  deprecatedAt?: string;
}

export interface TenantConfig {
  tenantId: string;
  tenantName: string;
  shardRuleType: ShardRuleType;
  migrationStatus: MigrationStatus;
  currentShardId?: string;
  oldShardId?: string;
  writeStrategy: WriteStrategy;
  readStrategy: ReadStrategy;
  migrationStartDate?: string;
  migrationEndDate?: string;
  customRuleParams?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyShardMapping {
  tenantId: string;
  year: number;
  month: number;
  shardId: string;
  tableName: string;
  isHistorical: boolean;
}

export interface ShardRuleConfig {
  ruleId: string;
  ruleType: ShardRuleType;
  description: string;
  hashFunction?: string;
  shardCount?: number;
  monthlyRetentionMonths?: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrderContext {
  tenantId: string;
  orderId?: string;
  orderNo?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  amount?: number;
  metadata?: Record<string, any>;
}

export interface RoutingKey {
  tenantId: string;
  timestamp?: number;
  orderId?: string;
  customKeys?: Record<string, string>;
}

export interface ShardTarget {
  shardId: string;
  database: string;
  table: string;
  isHistorical: boolean;
  confidence: number;
  reason: string;
}

export interface RoutingResult {
  success: boolean;
  requestId: string;
  timestamp: string;
  primaryTarget?: ShardTarget;
  alternativeTargets: ShardTarget[];
  routingKey: RoutingKey;
  tenantConfig: {
    tenantId: string;
    migrationStatus: MigrationStatus;
    writeStrategy: WriteStrategy;
    readStrategy: ReadStrategy;
  };
  auditRecords: AuditRecord[];
  warnings?: string[];
  errors?: string[];
  isMigrationInProgress: boolean;
  requiresDualWrite: boolean;
  requiresDualRead: boolean;
}

export interface WriteRoutingResult extends RoutingResult {
  writeTargets: ShardTarget[];
  writeStrategy: WriteStrategy;
  isIdempotentWrite: boolean;
  requiresCompensation: boolean;
  conflictResolution?: {
    strategy: string;
    actions: string[];
  };
}

export interface QueryRoutingResult extends RoutingResult {
  readTargets: ShardTarget[];
  readStrategy: ReadStrategy;
  queryPlan?: QueryPlan;
  conflictResolution?: {
    status: 'pending' | 'resolved' | 'error';
    message: string;
    pendingItems?: string[];
  };
}

export interface QueryPlanStep {
  stepId: string;
  order: number;
  shardId: string;
  database: string;
  table: string;
  timeRange: {
    from: string;
    to: string;
  };
  description: string;
  reason: string;
  canExecuteInParallel: boolean;
}

export interface QueryPlan {
  planId: string;
  totalSteps: number;
  steps: QueryPlanStep[];
  originalQuery: {
    tenantId: string;
    timeRange: {
      from: string;
      to: string;
    };
  };
  estimatedShardCount: number;
  executionStrategy: 'sequential' | 'parallel' | 'hybrid';
  warnings?: string[];
}

export interface DualReadResult {
  oldShardResult: any;
  newShardResult: any;
  hasConflict: boolean;
  conflictDetails?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  resolution: 'use_old' | 'use_new' | 'pending' | 'error';
}

export interface CompensationWriteRequest {
  orderId: string;
  tenantId: string;
  failedShardId: string;
  originalWriteTimestamp: string;
  operation: 'insert' | 'update' | 'delete';
  data: Record<string, any>;
  retryCount: number;
}

export interface AuditRecord {
  recordId: string;
  timestamp: string;
  action: string;
  shardId: string;
  operation: string;
  details: Record<string, any>;
  source: string;
}

export interface AppConfig {
  appName: string;
  port: number;
  environment: string;
  maxCrossMonthRange: number;
  enableDualRead: boolean;
  enableDualWrite: boolean;
  enableCompensation: boolean;
  auditEnabled: boolean;
}
