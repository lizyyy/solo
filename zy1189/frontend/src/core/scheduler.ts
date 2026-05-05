import { Task, TaskState, SimulationConfig, Event, EventType, TaskContext, Snapshot } from '@/types'
import { generateId, cloneTask, cloneContext, createStackFrame, calculateCpuUsage } from './utils'
import { DEFAULT_SIMULATION_CONFIG } from './constants'

export class Scheduler {
  private tasks: Map<string, Task> = new Map()
  private readyQueue: string[] = []
  private blockedQueue: string[] = []
  private waitingQueue: string[] = []
  
  private runningTaskId: string | null = null
  private tick: number = 0
  private events: Event[] = []
  private snapshots: Snapshot[] = []
  
  private config: SimulationConfig
  private timeSliceRemaining: number = 0
  private ioPendingTasks: Map<string, { remainingTicks: number; ioType: string }> = new Map()
  
  constructor(config?: Partial<SimulationConfig>) {
    this.config = { ...DEFAULT_SIMULATION_CONFIG, ...config }
    this.timeSliceRemaining = this.config.timeSlice
  }

  getTasks(): Task[] {
    return Array.from(this.tasks.values())
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id)
  }

  getReadyQueue(): string[] {
    return [...this.readyQueue]
  }

  getBlockedQueue(): string[] {
    return [...this.blockedQueue]
  }

  getRunningTask(): Task | undefined {
    return this.runningTaskId ? this.tasks.get(this.runningTaskId) : undefined
  }

  getTick(): number {
    return this.tick
  }

  getEvents(): Event[] {
    return [...this.events]
  }

  getSnapshots(): Snapshot[] {
    return [...this.snapshots]
  }

  getConfig(): SimulationConfig {
    return { ...this.config }
  }

  setConfig(config: Partial<SimulationConfig>): void {
    this.config = { ...this.config, ...config }
  }

  addTask(task: Task): void {
    this.tasks.set(task.id, task)
    this.transitionToReady(task.id)
    
    this.addEvent({
      type: EventType.TASK_CREATE,
      taskId: task.id,
      taskName: task.name,
      description: `创建${task.type === 'process' ? '进程' : task.type === 'thread' ? '线程' : '协程'}: ${task.name}`,
      details: {
        taskType: task.type,
        priority: task.priority
      },
      contextSnapshot: cloneContext(task.context)
    })
  }

  removeTask(id: string): boolean {
    const task = this.tasks.get(id)
    if (!task) return false
    
    this.readyQueue = this.readyQueue.filter(tid => tid !== id)
    this.blockedQueue = this.blockedQueue.filter(tid => tid !== id)
    this.waitingQueue = this.waitingQueue.filter(tid => tid !== id)
    this.ioPendingTasks.delete(id)
    
    if (this.runningTaskId === id) {
      this.runningTaskId = null
    }
    
    this.tasks.delete(id)
    return true
  }

  step(): Event[] {
    const stepEvents: Event[] = []
    const prevTick = this.tick
    this.tick++
    
    this.processIoPending(stepEvents)
    
    if (this.config.enableTimerInterrupt && prevTick > 0 && prevTick % this.config.timerInterval === 0) {
      this.handleTimerInterrupt(stepEvents)
    }
    
    const runningTask = this.runningTaskId ? this.tasks.get(this.runningTaskId) : null
    
    if (runningTask) {
      this.executeInstruction(runningTask, stepEvents)
      
      this.timeSliceRemaining--
      
      if (this.timeSliceRemaining <= 0 && this.config.enablePreemption) {
        this.preemptCurrentTask(stepEvents)
      }
    }
    
    if (!this.runningTaskId) {
      this.scheduleNext(stepEvents)
    }
    
    this.updateTaskTimes()
    
    return stepEvents
  }

  stepMulti(ticks: number): Event[] {
    const allEvents: Event[] = []
    for (let i = 0; i < ticks; i++) {
      const events = this.step()
      allEvents.push(...events)
    }
    return allEvents
  }

  takeSnapshot(description: string = ''): Snapshot {
    const totalCpuTime = Array.from(this.tasks.values())
      .reduce((sum, t) => sum + t.cpuTimeUsed, 0)
    
    const snapshot: Snapshot = {
      id: generateId(),
      tick: this.tick,
      timestamp: Date.now(),
      tasks: Array.from(this.tasks.values()).map(cloneTask),
      readyQueue: [...this.readyQueue],
      blockedQueue: [...this.blockedQueue],
      runningTaskId: this.runningTaskId ?? undefined,
      cpuUsage: calculateCpuUsage(this.tick, totalCpuTime),
      memoryUsage: Math.round((this.tasks.size * 4096) / (1024 * 1024) * 100) / 100,
      description
    }
    
    this.snapshots.push(snapshot)
    return snapshot
  }

  loadSnapshot(snapshot: Snapshot): void {
    this.tasks = new Map()
    snapshot.tasks.forEach(task => {
      this.tasks.set(task.id, cloneTask(task))
    })
    this.readyQueue = [...snapshot.readyQueue]
    this.blockedQueue = [...snapshot.blockedQueue]
    this.runningTaskId = snapshot.runningTaskId || null
    this.tick = snapshot.tick
  }

  private scheduleNext(events: Event[]): void {
    if (this.readyQueue.length === 0) return
    
    let nextTaskId: string
    
    switch (this.config.schedulerType) {
      case 'priority':
        nextTaskId = this.selectHighestPriority()
        break
      case 'fcfs':
        nextTaskId = this.readyQueue.shift()!
        break
      case 'round_robin':
      default:
        nextTaskId = this.readyQueue.shift()!
        break
    }
    
    this.startTask(nextTaskId, events)
  }

  private selectHighestPriority(): string {
    let highestPriority = -1
    let selectedIndex = 0
    
    this.readyQueue.forEach((id, index) => {
      const task = this.tasks.get(id)
      if (task && task.priority > highestPriority) {
        highestPriority = task.priority
        selectedIndex = index
      }
    })
    
    return this.readyQueue.splice(selectedIndex, 1)[0]
  }

  private startTask(taskId: string, events: Event[]): void {
    const task = this.tasks.get(taskId)
    if (!task) return
    
    if (task.startedAt === undefined) {
      task.startedAt = Date.now()
    }
    
    const prevRunningId = this.runningTaskId
    
    if (prevRunningId && prevRunningId !== taskId) {
      const prevTask = this.tasks.get(prevRunningId)
      if (prevTask) {
        this.contextSwitch(prevRunningId, taskId, events)
      }
    }
    
    this.runningTaskId = taskId
    task.state = TaskState.RUNNING
    this.timeSliceRemaining = this.config.timeSlice
    
    if (!prevRunningId || prevRunningId === taskId) {
      events.push(this.addEvent({
        type: EventType.TASK_START,
        taskId: task.id,
        taskName: task.name,
        description: `开始执行: ${task.name}`,
        details: {
          timeSlice: this.config.timeSlice,
          priority: task.priority
        }
      }))
    }
  }

  private contextSwitch(fromId: string, toId: string, events: Event[]): void {
    const fromTask = this.tasks.get(fromId)
    const toTask = this.tasks.get(toId)
    
    if (!fromTask || !toTask) return
    
    fromTask.state = TaskState.READY
    this.readyQueue.push(fromId)
    
    events.push(this.addEvent({
      type: EventType.CONTEXT_SWITCH,
      fromTaskId: fromId,
      toTaskId: toId,
      taskId: toId,
      taskName: toTask.name,
      description: `上下文切换: ${fromTask.name} -> ${toTask.name}`,
      details: {
        fromTask: {
          name: fromTask.name,
          type: fromTask.type,
          state: fromTask.state
        },
        toTask: {
          name: toTask.name,
          type: toTask.type,
          state: TaskState.RUNNING
        }
      },
      contextSnapshot: cloneContext(toTask.context)
    }))
  }

  private executeInstruction(task: Task, events: Event[]): void {
    if (task.currentInstructionIndex >= task.instructions.length) {
      this.terminateTask(task.id, events)
      return
    }
    
    const instruction = task.instructions[task.currentInstructionIndex]
    
    switch (instruction.type) {
      case 'compute':
        this.handleCompute(task, instruction, events)
        break
      case 'io':
        this.handleIo(task, instruction, events)
        break
      case 'syscall':
        this.handleSyscall(task, instruction, events)
        break
      case 'yield':
        this.handleYield(task, instruction, events)
        break
      case 'terminate':
        this.terminateTask(task.id, events)
        break
    }
  }

  private handleCompute(task: Task, instruction: Task['instructions'][0], events: Event[]): void {
    task.cpuTimeUsed++
    task.context.programCounter += 4
    
    const pcReg = task.context.registers.find(r => r.type === 'program_counter')
    if (pcReg) pcReg.value = task.context.programCounter
    
    if (task.cpuTimeUsed % instruction.duration === 0) {
      task.currentInstructionIndex++
    }
  }

  private handleIo(task: Task, instruction: Task['instructions'][0], events: Event[]): void {
    task.state = TaskState.BLOCKED
    this.runningTaskId = null
    
    const ioType = instruction.details?.ioType || 'disk'
    const ioTicks = this.config.ioLatency + instruction.duration
    
    this.ioPendingTasks.set(task.id, {
      remainingTicks: ioTicks,
      ioType
    })
    
    this.blockedQueue.push(task.id)
    
    events.push(this.addEvent({
      type: EventType.IO_START,
      taskId: task.id,
      taskName: task.name,
      description: `I/O 开始 (${ioType}): ${task.name}`,
      details: {
        ioType,
        expectedDuration: ioTicks
      },
      contextSnapshot: cloneContext(task.context)
    }))
  }

  private handleSyscall(task: Task, instruction: Task['instructions'][0], events: Event[]): void {
    const syscallType = instruction.details?.syscallType || 'generic'
    
    const prevMode = task.executionMode
    task.executionMode = 'kernel'
    task.context.executionMode = 'kernel'
    
    events.push(this.addEvent({
      type: EventType.SYSTEM_CALL,
      taskId: task.id,
      taskName: task.name,
      description: `系统调用 (${syscallType}): ${task.name}`,
      details: {
        syscallType,
        prevMode,
        newMode: 'kernel'
      },
      contextSnapshot: cloneContext(task.context)
    }))
    
    const frame = createStackFrame(`sys_${syscallType}`, { type: syscallType }, task.context.programCounter + 4)
    task.context.stack.frames.push(frame)
    task.context.stackPointer -= 32
    task.context.registers.find(r => r.type === 'stack_pointer')!.value = task.context.stackPointer
    
    switch (syscallType) {
      case 'sleep':
      case 'wait':
        task.state = TaskState.WAITING
        this.waitingQueue.push(task.id)
        this.runningTaskId = null
        break
      case 'read':
      case 'write':
        this.handleIo(task, { ...instruction, duration: 2 }, events)
        break
      default:
        task.currentInstructionIndex++
        task.executionMode = 'user'
        task.context.executionMode = 'user'
    }
  }

  private handleYield(task: Task, instruction: Task['instructions'][0], events: Event[]): void {
    const reason = instruction.details?.yieldReason || 'voluntary'
    
    events.push(this.addEvent({
      type: EventType.COROUTINE_YIELD,
      taskId: task.id,
      taskName: task.name,
      description: `协程让出: ${task.name} (${reason})`,
      details: {
        reason
      },
      contextSnapshot: cloneContext(task.context)
    }))
    
    task.state = TaskState.READY
    this.readyQueue.push(task.id)
    this.runningTaskId = null
    task.currentInstructionIndex++
  }

  private handleTimerInterrupt(events: Event[]): void {
    events.push(this.addEvent({
      type: EventType.TIMER_INTERRUPT,
      description: `定时器中断 (间隔: ${this.config.timerInterval} ticks)`,
      details: {
        interval: this.config.timerInterval,
        tick: this.tick
      }
    }))
  }

  private preemptCurrentTask(events: Event[]): void {
    const runningTask = this.runningTaskId ? this.tasks.get(this.runningTaskId) : null
    if (!runningTask) return
    
    runningTask.state = TaskState.READY
    this.readyQueue.push(this.runningTaskId)
    this.runningTaskId = null
  }

  private processIoPending(events: Event[]): void {
    const completedTasks: string[] = []
    
    this.ioPendingTasks.forEach((info, taskId) => {
      info.remainingTicks--
      
      if (info.remainingTicks <= 0) {
        completedTasks.push(taskId)
      }
    })
    
    completedTasks.forEach(taskId => {
      this.ioPendingTasks.delete(taskId)
      this.wakeupTask(taskId, events)
    })
  }

  private wakeupTask(taskId: string, events: Event[]): void {
    const task = this.tasks.get(taskId)
    if (!task) return
    
    this.blockedQueue = this.blockedQueue.filter(id => id !== taskId)
    this.waitingQueue = this.waitingQueue.filter(id => id !== taskId)
    
    task.state = TaskState.READY
    this.readyQueue.push(taskId)
    task.currentInstructionIndex++
    
    task.executionMode = 'user'
    task.context.executionMode = 'user'
    
    if (task.context.stack.frames.length > 0) {
      const frame = task.context.stack.frames.pop()!
      task.context.programCounter = frame.returnAddress
      task.context.stackPointer += 32
      task.context.registers.find(r => r.type === 'stack_pointer')!.value = task.context.stackPointer
      task.context.registers.find(r => r.type === 'program_counter')!.value = frame.returnAddress
    }
    
    events.push(this.addEvent({
      type: EventType.IO_COMPLETE,
      taskId: task.id,
      taskName: task.name,
      description: `I/O 完成，唤醒任务: ${task.name}`,
      details: {},
      contextSnapshot: cloneContext(task.context)
    }))
  }

  private terminateTask(taskId: string, events: Event[]): void {
    const task = this.tasks.get(taskId)
    if (!task) return
    
    task.state = TaskState.TERMINATED
    task.terminatedAt = Date.now()
    
    if (this.runningTaskId === taskId) {
      this.runningTaskId = null
    }
    
    this.readyQueue = this.readyQueue.filter(id => id !== taskId)
    this.blockedQueue = this.blockedQueue.filter(id => id !== taskId)
    this.ioPendingTasks.delete(taskId)
    
    events.push(this.addEvent({
      type: EventType.TASK_TERMINATE,
      taskId: task.id,
      taskName: task.name,
      description: `任务终止: ${task.name}`,
      details: {
        cpuTimeUsed: task.cpuTimeUsed,
        ioTimeUsed: task.ioTimeUsed,
        totalTime: task.totalTime
      },
      contextSnapshot: cloneContext(task.context)
    }))
  }

  private transitionToReady(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task) return
    
    task.state = TaskState.READY
    this.readyQueue.push(taskId)
  }

  private updateTaskTimes(): void {
    this.tasks.forEach(task => {
      if (task.state !== TaskState.TERMINATED) {
        task.totalTime++
      }
    })
  }

  private addEvent(event: Omit<Event, 'id' | 'timestamp' | 'tick'>): Event {
    const fullEvent: Event = {
      ...event,
      id: generateId(),
      timestamp: Date.now(),
      tick: this.tick
    }
    this.events.push(fullEvent)
    return fullEvent
  }
}
