export interface TerraformResource {
  address: string;
  type: string;
  name: string;
  provider_name: string;
  values: Record<string, any>;
}

export interface TerraformPlan {
  format_version: string;
  terraform_version: string;
  planned_values?: {
    root_module?: {
      resources?: TerraformResource[];
      child_modules?: Array<{
        resources?: TerraformResource[];
      }>;
    };
  };
  resource_changes?: Array<{
    address: string;
    type: string;
    name: string;
    change: {
      actions: string[];
      before?: Record<string, any>;
      after?: Record<string, any>;
      after_unknown?: Record<string, any>;
    };
  }>;
}

export interface IAMStatement {
  Effect: string;
  Action: string | string[];
  Resource?: string | string[];
  Principal?: string | string[] | Record<string, string | string[]>;
  Condition?: Record<string, any>;
  Sid?: string;
}

export interface IAMPolicy {
  Version?: string;
  Statement: IAMStatement | IAMStatement[];
}

export interface ResourceOwner {
  resource_type: string;
  resource_name: string;
  owner: string;
  email: string;
  department: string;
}

export interface ExceptionItem {
  resource: string;
  issue_type: string;
  reason: string;
  valid_until?: string;
}

export interface Issue {
  id: string;
  resource: string;
  resource_type: string;
  issue_type: 'wildcard_permission' | 'cross_account_trust' | 'public_bucket' | 'unregistered_owner' | 'unknown';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  affected_actions?: string[];
  affected_principals?: string[];
  is_exception: boolean;
  exception_reason?: string;
}

export interface RiskReport {
  summary: {
    total_issues: number;
    critical_count: number;
    high_count: number;
    medium_count: number;
    low_count: number;
    exceptions_count: number;
  };
  resources: {
    new_resources: TerraformResource[];
    modified_resources: TerraformResource[];
  };
  issues: Issue[];
  statistics: {
    by_type: Record<string, number>;
    by_severity: Record<string, number>;
    by_owner: Record<string, number>;
  };
}
