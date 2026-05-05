import { v4 as uuidv4 } from 'uuid'
import { Task, TaskContext, Register, Stack, StackFrame, TaskState, ExecutionMode, Instruction } from '@/types'
import { REGISTER_NAMES, STACK_SIZE } from './constants'

export const generateId = (): string => {
  return uuidv4()
}

export const createInitialContext = (baseStackAddr: number = 0x10000000): TaskContext => {
  const registers: Register[] = REGISTER_NAMES.map((name, index) => ({
    name,
    value: index === 8 ? 0x00401000 : (index === 7 ? baseStackAddr + STACK_SIZE - 4 : 0),
    type: name === 'eip' ? 'program_counter' : 
          name === 'esp' || name === 'ebp' ? 'stack_pointer' :
          name === 'eflags' ? 'status' : 'general'
  }))

  const stack: Stack = {
    baseAddress: baseStackAddr,
    topAddress: baseStackAddr + STACK_SIZE,
    pointer: baseStackAddr + STACK_SIZE - 4,
    frames: [],
    size: STACK_SIZE
  }

  return {
    registers,
    stack,
    programCounter: 0x00401000,
    stackPointer: baseStackAddr + STACK_SIZE - 4,
    statusWord: 0x202,
    executionMode: ExecutionMode.USER
  }
}

export const createTask = (
  name: string,
  type: Task['type'],
  instructions: Instruction[],
  priority: number = 1,
  parentTaskId?: string
): Task => {
  const stackBase = 0x10000000 + Math.floor(Math.random() * 0x1000000)
  
  return {
    id: generateId(),
    name,
    type,
    state: TaskState.NEW,
    priority,
    context: createInitialContext(stackBase),
    executionMode: ExecutionMode.USER,
    cpuTimeUsed: 0,
    ioTimeUsed: 0,
    totalTime: 0,
    parentTaskId,
    childTaskIds: [],
    entryPoint: name,
    instructions,
    currentInstructionIndex: 0,
    createdAt: Date.now()
  }
}

export const createStackFrame = (
  functionName: string,
  args: Record<string, any> = {},
  returnAddr: number = 0
): StackFrame => ({
  id: generateId(),
  functionName,
  arguments: args,
  returnAddress: returnAddr,
  localVariables: {}
})

export const cloneContext = (ctx: TaskContext): TaskContext => {
  return JSON.parse(JSON.stringify(ctx))
}

export const cloneTask = (task: Task): Task => {
  return JSON.parse(JSON.stringify(task))
}

export const formatHex = (num: number, width: number = 8): string => {
  return '0x' + num.toString(16).padStart(width, '0').toUpperCase()
}

export const calculateCpuUsage = (tick: number, totalCpuTime: number): number => {
  if (tick === 0) return 0
  return Math.round((totalCpuTime / tick) * 100)
}

export const isValidWorkload = (data: any): boolean => {
  if (!data || typeof data !== 'object') return false
  if (!data.version || !data.tasks || !Array.isArray(data.tasks)) return false
  
  for (const task of data.tasks) {
    if (!task.name || !task.type || !task.instructions) return false
    if (!Array.isArray(task.instructions)) return false
    
    for (const instr of task.instructions) {
      if (!instr.type || typeof instr.duration !== 'number') return false
    }
  }
  
  return true
}
