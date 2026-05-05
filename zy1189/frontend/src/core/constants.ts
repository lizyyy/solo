import { SimulationConfig, TaskType, TaskState, ExecutionMode } from '@/types'

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  timeSlice: 5,
  ioLatency: 3,
  schedulerType: 'round_robin',
  enablePreemption: true,
  enableTimerInterrupt: true,
  timerInterval: 5
}

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  [TaskType.PROCESS]: '进程',
  [TaskType.THREAD]: '线程',
  [TaskType.COROUTINE]: '协程'
}

export const TASK_STATE_LABELS: Record<TaskState, string> = {
  [TaskState.NEW]: '新建',
  [TaskState.READY]: '就绪',
  [TaskState.RUNNING]: '运行',
  [TaskState.WAITING]: '等待',
  [TaskState.BLOCKED]: '阻塞',
  [TaskState.TERMINATED]: '终止'
}

export const TASK_STATE_COLORS: Record<TaskState, string> = {
  [TaskState.NEW]: '#1890ff',
  [TaskState.READY]: '#52c41a',
  [TaskState.RUNNING]: '#fa8c16',
  [TaskState.WAITING]: '#722ed1',
  [TaskState.BLOCKED]: '#eb2f96',
  [TaskState.TERMINATED]: '#8c8c8c'
}

export const EXECUTION_MODE_LABELS: Record<ExecutionMode, string> = {
  [ExecutionMode.USER]: '用户态',
  [ExecutionMode.KERNEL]: '内核态'
}

export const EXECUTION_MODE_COLORS: Record<ExecutionMode, string> = {
  [ExecutionMode.USER]: '#1890ff',
  [ExecutionMode.KERNEL]: '#fa8c16'
}

export const REGISTER_NAMES = [
  'eax', 'ebx', 'ecx', 'edx',
  'esi', 'edi', 'ebp', 'esp',
  'eip', 'eflags'
]

export const STACK_SIZE = 1024
