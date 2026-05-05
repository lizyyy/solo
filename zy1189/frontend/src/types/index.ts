export enum TaskType {
  PROCESS = 'process',
  THREAD = 'thread',
  COROUTINE = 'coroutine'
}

export enum TaskState {
  NEW = 'new',
  READY = 'ready',
  RUNNING = 'running',
  WAITING = 'waiting',
  BLOCKED = 'blocked',
  TERMINATED = 'terminated'
}

export enum ExecutionMode {
  USER = 'user',
  KERNEL = 'kernel'
}

export enum EventType {
  TASK_CREATE = 'task_create',
  TASK_START = 'task_start',
  CONTEXT_SWITCH = 'context_switch',
  SYSTEM_CALL = 'system_call',
  TIMER_INTERRUPT = 'timer_interrupt',
  IO_START = 'io_start',
  IO_COMPLETE = 'io_complete',
  COROUTINE_YIELD = 'coroutine_yield',
  COROUTINE_RESUME = 'coroutine_resume',
  TASK_BLOCK = 'task_block',
  TASK_WAKEUP = 'task_wakeup',
  TASK_TERMINATE = 'task_terminate'
}

export interface Register {
  name: string
  value: number
  type: 'general' | 'program_counter' | 'stack_pointer' | 'status'
}

export interface StackFrame {
  id: string
  functionName: string
  arguments: Record<string, any>
  returnAddress: number
  localVariables: Record<string, any>
}

export interface Stack {
  baseAddress: number
  topAddress: number
  pointer: number
  frames: StackFrame[]
  size: number
}

export interface TaskContext {
  registers: Register[]
  stack: Stack
  programCounter: number
  stackPointer: number
  statusWord: number
  executionMode: ExecutionMode
}

export interface Task {
  id: string
  name: string
  type: TaskType
  state: TaskState
  priority: number
  processId?: string
  threadId?: string
  
  context: TaskContext
  executionMode: ExecutionMode
  
  cpuTimeUsed: number
  ioTimeUsed: number
  totalTime: number
  
  parentTaskId?: string
  childTaskIds: string[]
  
  entryPoint: string
  instructions: Instruction[]
  currentInstructionIndex: number
  
  waitForEvent?: string
  waitReason?: string
  
  createdAt: number
  startedAt?: number
  terminatedAt?: number
}

export interface Instruction {
  type: 'compute' | 'io' | 'syscall' | 'yield' | 'terminate'
  description: string
  duration: number
  details?: {
    syscallType?: string
    ioType?: string
    yieldReason?: string
  }
}

export interface Event {
  id: string
  type: EventType
  timestamp: number
  tick: number
  
  taskId?: string
  taskName?: string
  
  fromTaskId?: string
  toTaskId?: string
  
  description: string
  details: Record<string, any>
  
  contextSnapshot?: TaskContext
}

export interface Experiment {
  id: string
  name: string
  description: string
  
  configuration: SimulationConfig
  tasks: Task[]
  events: Event[]
  snapshots: Snapshot[]
  
  createdAt: number
  updatedAt: number
  lastTick: number
  isRunning: boolean
}

export interface SimulationConfig {
  timeSlice: number
  ioLatency: number
  schedulerType: 'round_robin' | 'priority' | 'fcfs'
  enablePreemption: boolean
  enableTimerInterrupt: boolean
  timerInterval: number
}

export interface Snapshot {
  id: string
  tick: number
  timestamp: number
  
  tasks: Task[]
  readyQueue: string[]
  blockedQueue: string[]
  runningTaskId?: string
  
  cpuUsage: number
  memoryUsage: number
  
  description: string
}

export interface Workload {
  version: string
  name: string
  description: string
  tasks: WorkloadTask[]
  config: Partial<SimulationConfig>
}

export interface WorkloadTask {
  name: string
  type: TaskType
  priority: number
  instructions: Instruction[]
  parentTask?: string
}

export interface AnalysisReport {
  experimentId: string
  experimentName: string
  generatedAt: number
  
  summary: {
    totalTicks: number
    totalTasks: number
    totalEvents: number
    avgCpuUsage: number
    contextSwitchCount: number
  }
  
  taskStats: TaskStatistics[]
  eventAnalysis: EventAnalysis
  anomalies: Anomaly[]
  recommendations: string[]
}

export interface TaskStatistics {
  taskId: string
  taskName: string
  taskType: TaskType
  
  stateTransitions: {
    from: TaskState
    to: TaskState
    tick: number
  }[]
  
  cpuTime: number
  ioTime: number
  waitTime: number
  
  executionModeTime: {
    user: number
    kernel: number
  }
  
  contextSwitches: number
}

export interface EventAnalysis {
  byType: Record<EventType, number>
  byTick: {
    tick: number
    count: number
    types: EventType[]
  }[]
  avgInterval: number
}

export interface Anomaly {
  type: 'deadlock' | 'starvation' | 'long_wait' | 'high_priority_overtake'
  severity: 'low' | 'medium' | 'high'
  description: string
  affectedTasks: string[]
  detectedAtTick: number
}
