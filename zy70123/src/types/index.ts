export interface Hall {
  id: string;
  name: string;
  capacity: number;
  createdAt: number;
  updatedAt: number;
}

export interface Movie {
  id: string;
  name: string;
  duration: number;
  createdAt: number;
  updatedAt: number;
}

export interface Key {
  id: string;
  movieId: string;
  startAt: number;
  endAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface CleaningRule {
  id: string;
  hallId: string;
  duration: number;
  createdAt: number;
  updatedAt: number;
}

export interface Schedule {
  id: string;
  hallId: string;
  movieId: string;
  startAt: number;
  endAt: number;
  ticketLock: boolean;
  ticketLockReason?: string;
  status: 'active' | 'cancelled' | 'completed';
  createdAt: number;
  updatedAt: number;
}

export enum ConflictType {
  KEY_WINDOW = 'KEY_WINDOW',
  CLEANING_GAP = 'CLEANING_GAP',
  TICKET_LOCK = 'TICKET_LOCK',
  TIME_OVERLAP = 'TIME_OVERLAP'
}

export enum CompensationType {
  REFUND = 'REFUND',
  VOUCHER = 'VOUCHER',
  RESCHEDULE = 'RESCHEDULE',
  MANUAL = 'MANUAL'
}

export enum TaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED'
}

export interface Conflict {
  id: string;
  type: ConflictType;
  scheduleId: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  affectedScheduleIds?: string[];
  createdAt: number;
  resolvedAt?: number;
}

export interface CompensationTask {
  id: string;
  scheduleId: string;
  type: CompensationType;
  status: TaskStatus;
  attempts: number;
  maxAttempts: number;
  errorMessage?: string;
  payload: Record<string, any>;
  result?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  lastAttemptAt?: number;
}

export interface ConflictReport {
  conflictId: string;
  type: ConflictType;
  schedule: Schedule;
  affectedSchedules?: Schedule[];
  description: string;
  ticketLockRequired: boolean;
  ticketLockReason?: string;
  suggestedCompensations: {
    type: CompensationType;
    description: string;
  }[];
}

export interface ScheduleChangeResult {
  success: boolean;
  schedule: Schedule;
  conflicts: Conflict[];
  conflictReports: ConflictReport[];
  ticketLocks: {
    scheduleId: string;
    locked: boolean;
    reason?: string;
  }[];
  compensationTasks: CompensationTask[];
}

export interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  status: TaskStatus;
  attempts: number;
  result?: Record<string, any>;
  errorMessage?: string;
}
