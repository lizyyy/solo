export enum OverrideSource {
  DEFAULT = 'default',
  ENVIRONMENT = 'environment',
  USER_GROUP = 'user_group',
  TENANT = 'tenant',
  MANUAL = 'manual',
  ROLLOUT = 'rollout'
}

export enum EvaluationStatus {
  PENDING = 'pending',
  MATCHING = 'matching',
  EVALUATED = 'evaluated',
  ERROR = 'error',
  MANUALLY_CORRECTED = 'manually_corrected'
}

export interface EnvironmentRule {
  id: string;
  name: string;
  environment: string;
  enabled: boolean;
  priority: number;
  conditions: Record<string, any>;
}

export interface UserGroup {
  id: string;
  name: string;
  conditions: {
    userIds?: string[];
    emails?: string[];
    domains?: string[];
    attributes?: Record<string, any>;
  };
  priority: number;
  enabled: boolean;
}

export interface FeatureFlag {
  id: string;
  name: string;
  description?: string;
  defaultValue: boolean;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  environmentRules: EnvironmentRule[];
  userGroups: UserGroup[];
  rolloutPercentage?: number;
}

export interface OverrideLink {
  source: OverrideSource;
  sourceId: string;
  sourceName: string;
  previousValue: boolean;
  newValue: boolean;
  reason: string;
  timestamp: Date;
}

export interface EvaluationContext {
  flagName: string;
  tenantId: string;
  userId?: string;
  email?: string;
  environment: string;
  attributes: Record<string, any>;
  timestamp: Date;
}

export interface ExplanationReport {
  id: string;
  context: EvaluationContext;
  status: EvaluationStatus;
  finalValue: boolean;
  overrideChain: OverrideLink[];
  matchedRules: string[];
  matchedGroups: string[];
  rawInput: string;
  processingLog: string[];
  error?: {
    message: string;
    stack?: string;
    step: string;
  };
  manualCorrection?: {
    correctedBy: string;
    correctionReason: string;
    correctedAt: Date;
    originalValue: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExplanationRequest {
  flagName: string;
  tenantId: string;
  userId?: string;
  email?: string;
  environment: string;
  attributes?: Record<string, any>;
}

export interface ManualCorrectionRequest {
  reportId: string;
  correctedValue: boolean;
  correctedBy: string;
  correctionReason: string;
}

export interface QueryParams {
  flagName?: string;
  tenantId?: string;
  userId?: string;
  status?: EvaluationStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
