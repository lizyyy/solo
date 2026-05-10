export const SLOType = {
  AVAILABILITY: 'AVAILABILITY',
  LATENCY: 'LATENCY',
  ERROR_RATE: 'ERROR_RATE',
} as const;

export type SLOType = (typeof SLOType)[keyof typeof SLOType];

export const TimeWindowType = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  ROLLING_24H: 'ROLLING_24H',
  ROLLING_7D: 'ROLLING_7D',
  ROLLING_30D: 'ROLLING_30D',
} as const;

export type TimeWindowType = (typeof TimeWindowType)[keyof typeof TimeWindowType];

export const ErrorSource = {
  API: 'API',
  INTERNAL: 'INTERNAL',
  EXTERNAL: 'EXTERNAL',
  MANUAL: 'MANUAL',
} as const;

export type ErrorSource = (typeof ErrorSource)[keyof typeof ErrorSource];

export const FreezeReason = {
  BUDGET_EXHAUSTED: 'BUDGET_EXHAUSTED',
  MANUAL_FREEZE: 'MANUAL_FREEZE',
  MAINTENANCE: 'MAINTENANCE',
  INCIDENT: 'INCIDENT',
} as const;

export type FreezeReason = (typeof FreezeReason)[keyof typeof FreezeReason];

export const ProcessStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED',
} as const;

export type ProcessStatus = (typeof ProcessStatus)[keyof typeof ProcessStatus];

export const ProcessStep = {
  SLO_CONFIG_REVIEW: 'SLO_CONFIG_REVIEW',
  ERROR_SAMPLE_VALIDATION: 'ERROR_SAMPLE_VALIDATION',
  BUDGET_DEDUCTION: 'BUDGET_DEDUCTION',
  BUDGET_FREEZE: 'BUDGET_FREEZE',
  ALERT_SUPPRESSION: 'ALERT_SUPPRESSION',
  REPORT_GENERATION: 'REPORT_GENERATION',
} as const;

export type ProcessStep = (typeof ProcessStep)[keyof typeof ProcessStep];

export const SLOTypeValues = Object.values(SLOType);
export const TimeWindowTypeValues = Object.values(TimeWindowType);
export const ErrorSourceValues = Object.values(ErrorSource);
export const FreezeReasonValues = Object.values(FreezeReason);
export const ProcessStatusValues = Object.values(ProcessStatus);
export const ProcessStepValues = Object.values(ProcessStep);
