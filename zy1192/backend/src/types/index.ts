export interface Thread {
  id: string;
  name: string;
  state: 'idle' | 'running' | 'waiting' | 'blocked' | 'finished';
  priority: number;
  startTime: number;
  endTime?: number;
}

export interface LockState {
  type: 'mutex' | 'rwlock' | 'spinlock';
  name: string;
  isLocked: boolean;
  ownerThreadId?: string;
  readCount: number;
  writeCount: number;
  waitingThreads: string[];
  spinCount: number;
}

export interface CASOperation {
  id: string;
  threadId: string;
  expected: number;
  newValue: number;
  success: boolean;
  actualValue: number;
  timestamp: number;
}

export interface QueueNode<T> {
  value: T;
  next: QueueNode<T> | null;
  version: number;
}

export interface ABAEvent {
  type: 'enqueue' | 'dequeue' | 'peek';
  threadId: string;
  beforeValue?: number;
  afterValue?: number;
  beforeVersion: number;
  afterVersion: number;
  timestamp: number;
  isABA: boolean;
}

export interface TimelineEvent {
  id: string;
  timestamp: number;
  threadId: string;
  threadName: string;
  eventType: 
    | 'lock_acquire_attempt' 
    | 'lock_acquire_success' 
    | 'lock_acquire_failed'
    | 'lock_release'
    | 'cas_attempt'
    | 'cas_success'
    | 'cas_failed'
    | 'enqueue_attempt'
    | 'enqueue_success'
    | 'dequeue_attempt'
    | 'dequeue_success'
    | 'spin_start'
    | 'spin_end'
    | 'wait_start'
    | 'wait_end'
    | 'thread_start'
    | 'thread_end'
    | 'aba_detected';
  details: Record<string, unknown>;
  lockName?: string;
  cost: number;
}

export interface SimulationConfig {
  threadCount: number;
  lockType: 'mutex' | 'rwlock' | 'spinlock' | 'cas' | 'lock-free-queue';
  operationSequence: OperationStep[];
  contentionLevel: 'low' | 'medium' | 'high';
  enableABAReproduction: boolean;
  abaSteps?: ABAStep[];
  duration: number;
}

export interface OperationStep {
  threadId: string;
  operation: 'read' | 'write' | 'cas' | 'lock' | 'unlock' | 'enqueue' | 'dequeue';
  target?: string;
  value?: number;
  expectedValue?: number;
  delay: number;
}

export interface ABAStep {
  threadId: string;
  action: 'read' | 'modify' | 'restore';
  description: string;
  delay: number;
}

export interface SimulationResult {
  config: SimulationConfig;
  threads: Thread[];
  timeline: TimelineEvent[];
  lockStates: Map<string, LockState>;
  casOperations: CASOperation[];
  abaEvents: ABAEvent[];
  metrics: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    totalWaitTime: number;
    totalSpinTime: number;
    throughput: number;
    avgWaitTime: number;
    avgSpinTime: number;
    abaIncidents: number;
    contentionRate: number;
  };
  queueState?: {
    size: number;
    head: number | null;
    tail: number | null;
    version: number;
  };
}

export interface Example {
  id: string;
  name: string;
  description: string;
  config: SimulationConfig;
  expectedOutcome: string;
}

export type PrimitiveType = 'mutex' | 'rwlock' | 'spinlock' | 'cas' | 'lock-free-queue' | 'aba';
