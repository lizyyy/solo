export const ConfigStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  DEPRECATED: 'DEPRECATED',
} as const;

export type ConfigStatus = typeof ConfigStatus[keyof typeof ConfigStatus];

export const InstanceStatus = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  UNHEALTHY: 'UNHEALTHY',
} as const;

export type InstanceStatus = typeof InstanceStatus[keyof typeof InstanceStatus];

export const PullStatus = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  PENDING: 'PENDING',
  TIMEOUT: 'TIMEOUT',
} as const;

export type PullStatus = typeof PullStatus[keyof typeof PullStatus];

export const EffectiveStatus = {
  EFFECTIVE: 'EFFECTIVE',
  NOT_EFFECTIVE: 'NOT_EFFECTIVE',
  PARTIAL: 'PARTIAL',
  UNKNOWN: 'UNKNOWN',
} as const;

export type EffectiveStatus = typeof EffectiveStatus[keyof typeof EffectiveStatus];

export const CompensateStatus = {
  NOT_NEEDED: 'NOT_NEEDED',
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export type CompensateStatus = typeof CompensateStatus[keyof typeof CompensateStatus];
