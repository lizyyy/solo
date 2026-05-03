export interface ExpectedJob {
  name: string;
  type: 'launchagent' | 'cron';
  schedule: string;
  command: string;
  enabled: boolean;
  owner: string;
  sla: number;
  environment: Record<string, string>;
  description?: string;
}

export interface LaunchAgentPlist {
  Label: string;
  ProgramArguments?: string[];
  Program?: string;
  StartInterval?: number;
  StartCalendarInterval?: {
    Minute?: number;
    Hour?: number;
    Day?: number;
    Weekday?: number;
    Month?: number;
  }[];
  RunAtLoad?: boolean;
  KeepAlive?: boolean | Record<string, unknown>;
  EnvironmentVariables?: Record<string, string>;
  Disabled?: boolean;
}

export interface CronJob {
  minute: string;
  hour: string;
  day: string;
  month: string;
  weekday: string;
  command: string;
  lineNumber: number;
}

export interface LastRun {
  jobName: string;
  timestamp: number;
  exitCode: number;
  duration: number;
  output?: string;
  error?: string;
}

export interface Owner {
  jobName: string;
  owner: string;
  email: string;
  department: string;
}

export interface JobAudit {
  jobName: string;
  type: 'launchagent' | 'cron';
  expected: ExpectedJob | null;
  actual: {
    schedule: string;
    command: string;
    enabled: boolean;
    environment: Record<string, string>;
    plistPath?: string;
    owner?: string;
  } | null;
  lastRuns: LastRun[];
  ownerInfo: Owner | null;
  issues: Issue[];
}

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface Issue {
  id: string;
  jobName: string;
  type: IssueType;
  severity: IssueSeverity;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

export type IssueType =
  | 'DISABLED'
  | 'DUPLICATE_TRIGGER'
  | 'TIMEZONE_MISMATCH'
  | 'SLA_VIOLATION'
  | 'SCRIPT_PATH_INVALID'
  | 'EXPECTED_MISSING'
  | 'ACTUAL_MISSING'
  | 'SCHEDULE_MISMATCH'
  | 'COMMAND_MISMATCH'
  | 'ENVIRONMENT_MISMATCH'
  | 'OWNER_MISMATCH'
  | 'PARSE_ERROR'
  | 'ENABLED_MISMATCH'
  | 'UNEXPECTED_JOB';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  file: string;
  line?: number;
  field?: string;
  message: string;
}

export interface AuditReport {
  generatedAt: string;
  totalJobs: number;
  issuesBySeverity: Record<IssueSeverity, number>;
  issuesByType: Record<IssueType, number>;
  jobsWithIssues: number;
  jobsWithoutIssues: number;
  slaCompliance: number;
  jobs: JobAudit[];
}
