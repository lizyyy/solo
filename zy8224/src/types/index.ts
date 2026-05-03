export interface GitHubWorkflow {
  name: string;
  filename: string;
  on: WorkflowTrigger;
  jobs: Record<string, Job>;
  env?: Record<string, string>;
  defaults?: Record<string, unknown>;
  rawContent: string;
}

export interface WorkflowTrigger {
  push?: PushTrigger;
  pull_request?: PullRequestTrigger;
  workflow_dispatch?: WorkflowDispatchTrigger;
  schedule?: ScheduleTrigger[];
  workflow_call?: WorkflowCallTrigger;
  repository_dispatch?: RepositoryDispatchTrigger;
  concurrency?: ConcurrencyConfig | string;
}

export interface PushTrigger {
  branches?: string[];
  branches_ignore?: string[];
  tags?: string[];
  tags_ignore?: string[];
  paths?: string[];
  paths_ignore?: string[];
}

export interface PullRequestTrigger {
  types?: string[];
  branches?: string[];
  branches_ignore?: string[];
  paths?: string[];
  paths_ignore?: string[];
}

export interface WorkflowDispatchTrigger {
  inputs?: Record<string, WorkflowDispatchInput>;
}

export interface WorkflowDispatchInput {
  description?: string;
  required?: boolean;
  default?: string;
  type?: string;
  options?: string[];
}

export interface ScheduleTrigger {
  cron: string;
}

export interface WorkflowCallTrigger {
  inputs?: Record<string, WorkflowCallInput>;
  secrets?: Record<string, WorkflowCallSecret>;
  outputs?: Record<string, string>;
}

export interface WorkflowCallInput {
  description?: string;
  required?: boolean;
  default?: string;
  type: string;
}

export interface WorkflowCallSecret {
  description?: string;
  required?: boolean;
}

export interface RepositoryDispatchTrigger {
  types?: string[];
}

export interface Job {
  name?: string;
  runs_on?: string | string[];
  needs?: string | string[];
  if?: string;
  env?: Record<string, string>;
  steps?: Step[];
  strategy?: unknown;
  concurrency?: unknown;
  uses?: string;
  with?: Record<string, string | number | boolean>;
  secrets?: Record<string, string> | string;
  timeout_minutes?: number;
  permissions?: Record<string, string>;
  environment?: unknown;
}

export interface Step {
  name?: string;
  id?: string;
  uses?: string;
  run?: string;
  shell?: string;
  working_directory?: string;
  env?: Record<string, string>;
  with?: Record<string, string | number | boolean>;
  if?: string;
  continue_on_error?: boolean;
  timeout_minutes?: number;
}

export interface Strategy {
  matrix?: Record<string, (string | number)[] | { include?: MatrixInclude[]; exclude?: MatrixExclude[] }>;
  fail_fast?: boolean;
  max_parallel?: number;
}

export interface MatrixInclude {
  [key: string]: string | number;
}

export interface MatrixExclude {
  [key: string]: string | number;
}

export interface ConcurrencyConfig {
  group: string;
  cancel_in_progress?: boolean;
}

export interface EnvironmentConfig {
  name: string;
  url?: string;
}

export interface EnvironmentManifest {
  environments: EnvironmentInfo[];
}

export interface EnvironmentInfo {
  name: string;
  type: 'prod' | 'non-prod';
  branches: string[];
  description?: string;
}

export interface SecretWhitelist {
  prodSecrets: string[];
  nonProdSecrets: string[];
  environmentSecrets: Record<string, string[]>;
}

export interface ApprovalRule {
  rules: ApprovalPolicy[];
}

export interface ApprovalPolicy {
  environment: string;
  triggerType: string[];
  requiresApproval: boolean;
  approvers?: string[];
  minApprovals?: number;
}

export interface ArtifactConfig {
  name: string;
  retention_days?: number;
  path?: string;
}

export interface Issue {
  id: string;
  category: IssueCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  workflow: string;
  job?: string;
  step?: string;
  title: string;
  description: string;
  remediation?: string;
  location?: {
    line?: number;
    column?: number;
  };
}

export type IssueCategory = 
  | 'secret_exposure'
  | 'matrix_coverage'
  | 'concurrency_conflict'
  | 'artifact_expiration'
  | 'approval_missing';

export interface Report {
  generatedAt: Date;
  summary: ReportSummary;
  issues: Issue[];
  workflows: WorkflowSummary[];
  metadata: ReportMetadata;
}

export interface ReportSummary {
  totalWorkflows: number;
  totalJobs: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
}

export interface WorkflowSummary {
  name: string;
  filename: string;
  triggerTypes: string[];
  jobCount: number;
  hasWorkflowCall: boolean;
  environments: string[];
}

export interface ReportMetadata {
  toolVersion: string;
  scanDirectory: string;
  configFiles: {
    environments?: string;
    secretWhitelist?: string;
    approvalRules?: string;
  };
}

export interface CliOptions {
  workflowsDir: string;
  environments: string;
  secrets: string;
  approval: string;
  output: string;
  verbose: boolean;
  failOnCritical: boolean;
}
