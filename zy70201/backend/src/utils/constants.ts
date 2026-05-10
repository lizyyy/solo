export const SlopeDifficulty = {
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
  EXPERT: 'EXPERT'
} as const;

export type SlopeDifficulty = typeof SlopeDifficulty[keyof typeof SlopeDifficulty];

export const SlopeStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  MAINTENANCE: 'MAINTENANCE'
} as const;

export type SlopeStatus = typeof SlopeStatus[keyof typeof SlopeStatus];

export const VehicleStatus = {
  AVAILABLE: 'AVAILABLE',
  MAINTENANCE: 'MAINTENANCE',
  WORKING: 'WORKING',
  BROKEN: 'BROKEN'
} as const;

export type VehicleStatus = typeof VehicleStatus[keyof typeof VehicleStatus];

export const TaskStatus = {
  PENDING_ASSIGNMENT: 'PENDING_ASSIGNMENT',
  PENDING_EXECUTION: 'PENDING_EXECUTION',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED'
} as const;

export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus];
