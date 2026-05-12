export type Environment = 'test' | 'staging' | 'production';

export interface UserAttributes {
  userId: string;
  email?: string;
  phone?: string;
  isVip?: boolean;
  country?: string;
  [key: string]: any;
}

export interface Rule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  environment: Environment | 'all';
  percentage?: number;
  whitelist?: string[];
  blacklist?: string[];
  attributes?: {
    [key: string]: {
      eq?: any;
      neq?: any;
      in?: any[];
      notIn?: any[];
      contains?: string;
    };
  };
}

export interface FeatureFlag {
  id: string;
  name: string;
  description?: string;
  globallyDisabled: boolean;
  rules: Rule[];
  createdAt: number;
  updatedAt: number;
}

export interface FlagVersion {
  version: number;
  flag: FeatureFlag;
  timestamp: number;
  action: 'create' | 'update' | 'rollback';
  previousVersion?: number;
}

export interface StoreData {
  flags: {
    [flagId: string]: FeatureFlag;
  };
  versions: {
    [flagId: string]: FlagVersion[];
  };
  envOverrides: {
    [env in Environment]?: {
      [flagId: string]: {
        enabled: boolean;
        percentage?: number;
      };
    };
  };
}

export interface EvaluationResult {
  enabled: boolean;
  flag: FeatureFlag;
  matchedRule?: Rule;
  reason: string;
  path: string[];
  computedFields: {
    userId: string;
    environment: Environment;
    percentage?: number;
    bucket?: number;
  };
  version: number;
}

export interface ExplainResult extends EvaluationResult {
  allRules: Rule[];
  environment: Environment;
  globalDisabled: boolean;
  envOverride?: {
    enabled: boolean;
    percentage?: number;
  };
}
