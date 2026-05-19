import { v4 as uuidv4 } from 'uuid'
import {
  Task,
  TaskStatus,
  TaskPriority,
  Patient,
  Escort,
  TransferRecord,
  TaskStats
} from '../models/types'
import { storage } from './storage'
import { createSensitiveLogger } from '../utils/sensitiveMask'

const logger = createSensitiveLogger()

export class TaskService {
  private generateIdempotencyKey(operation: string, data: any): string {
    const dataStr = JSON.stringify(data)
    return `${operation}-${Buffer.from(dataStr).toString('base64').slice(0, 32)}`
  }

  public checkIdempotency(key: string): Task | null {
    const record = storage.getIdempotencyRecord(key)
    if (record) {
      const task = storage.getTaskById(record.taskId)
      if (task) {
        logger.info('检测到重复请求，返回已有结果', { idempotencyKey: key })
        return task
      }
    }
    return null
  }

  public createTask(
    patient: Patient,
    checkType: string,
    checkLocation: string,
    priority: TaskPriority = TaskPriority.NORMAL,
    remarks?: string,
    idempotencyKey?: string
  ): Task {
    const key = idempotencyKey || this.generateIdempotencyKey('create', { patient, checkType, checkLocation })
    
    const existingTask = this.checkIdempotency(key)
    if (existingTask) {
      return existingTask
    }

    const now = Date.now()
    const task: Task = {
      id: uuidv4(),
      idempotencyKey: key,
      patientId: patient.id,
      patient,
      status: TaskStatus.PENDING,
      priority,
      checkType,
      checkLocation,
      createdAt: now,
      remarks,
      transferHistory: []
    }

    storage.saveTask(task)
    
    storage.saveIdempotencyRecord({
      key,
      taskId: task.id,
      operation: 'create',
      createdAt: now
    })

    logger.info('任务创建成功', { taskId: task.id })
    return task
  }

  public assignTask(taskId: string, escortId: string, operator: string, idempotencyKey?: string): Task {
    const key = idempotencyKey || this.generateIdempotencyKey('assign', { taskId, escortId })
    
    const existingTask = this.checkIdempotency(key)
    if (existingTask) {
      return existingTask
    }

    const task = storage.getTaskById(taskId)
    if (!task) {
      throw new Error('任务不存在')
    }

    if (task.status !== TaskStatus.PENDING && task.status !== TaskStatus.ASSIGNED) {
      throw new Error('当前任务状态不允许派单')
    }

    const escort = storage.getEscortById(escortId)
    if (!escort) {
      throw new Error('陪检员不存在')
    }

    if (escort.status !== 'available') {
      throw new Error('陪检员当前不可用')
    }

    const now = Date.now()
    task.escortId = escortId
    task.escort = escort
    task.status = TaskStatus.ASSIGNED
    task.assignedAt = now

    escort.status = 'busy'
    escort.currentTaskId = taskId
    storage.saveEscort(escort)

    storage.saveTask(task)
    
    storage.saveIdempotencyRecord({
      key,
      taskId: task.id,
      operation: 'assign',
      createdAt: now
    })

    logger.info('任务派单成功', { taskId, escortId, operator })
    return task
  }

  public acceptTask(taskId: string, escortId: string, idempotencyKey?: string): Task {
    const key = idempotencyKey || this.generateIdempotencyKey('accept', { taskId, escortId })
    
    const existingTask = this.checkIdempotency(key)
    if (existingTask) {
      return existingTask
    }

    const task = storage.getTaskById(taskId)
    if (!task) {
      throw new Error('任务不存在')
    }

    if (task.status !== TaskStatus.ASSIGNED) {
      throw new Error('当前任务状态不允许接单')
    }

    if (task.escortId !== escortId) {
      throw new Error('只能接分配给自己的任务')
    }

    const now = Date.now()
    task.status = TaskStatus.IN_PROGRESS
    task.startedAt = now
    task.acceptedAt = now

    const waitTimeMs = now - task.createdAt
    task.waitTimeMinutes = Math.round(waitTimeMs / 60000)

    storage.saveTask(task)
    
    storage.saveIdempotencyRecord({
      key,
      taskId: task.id,
      operation: 'accept',
      createdAt: now
    })

    logger.info('任务接单成功', { taskId, escortId })
    return task
  }

  public transferTask(
    taskId: string,
    fromEscortId: string,
    toEscortId: string,
    reason: string,
    operator: string,
    idempotencyKey?: string
  ): Task {
    const key = idempotencyKey || this.generateIdempotencyKey('transfer', { taskId, fromEscortId, toEscortId })
    
    const existingTask = this.checkIdempotency(key)
    if (existingTask) {
      return existingTask
    }

    const task = storage.getTaskById(taskId)
    if (!task) {
      throw new Error('任务不存在')
    }

    if (task.status !== TaskStatus.ASSIGNED && task.status !== TaskStatus.IN_PROGRESS) {
      throw new Error('当前任务状态不允许转派')
    }

    if (task.escortId !== fromEscortId) {
      throw new Error('只能转派分配给自己的任务')
    }

    const fromEscort = storage.getEscortById(fromEscortId)
    const toEscort = storage.getEscortById(toEscortId)

    if (!fromEscort || !toEscort) {
      throw new Error('陪检员不存在')
    }

    if (toEscort.status !== 'available') {
      throw new Error('目标陪检员当前不可用')
    }

    const now = Date.now()
    const transferRecord: TransferRecord = {
      id: uuidv4(),
      fromEscortId,
      toEscortId,
      transferredAt: now,
      reason,
      operator
    }

    task.transferHistory.push(transferRecord)
    task.escortId = toEscortId
    task.escort = toEscort
    task.status = TaskStatus.ASSIGNED
    task.assignedAt = now

    fromEscort.status = 'available'
    fromEscort.currentTaskId = undefined
    storage.saveEscort(fromEscort)

    toEscort.status = 'busy'
    toEscort.currentTaskId = taskId
    storage.saveEscort(toEscort)

    storage.saveTask(task)
    
    storage.saveIdempotencyRecord({
      key,
      taskId: task.id,
      operation: 'transfer',
      createdAt: now
    })

    logger.info('任务转派成功', { taskId, fromEscortId, toEscortId, operator })
    return task
  }

  public completeTask(taskId: string, escortId: string, idempotencyKey?: string): Task {
    const key = idempotencyKey || this.generateIdempotencyKey('complete', { taskId, escortId })
    
    const existingTask = this.checkIdempotency(key)
    if (existingTask) {
      return existingTask
    }

    const task = storage.getTaskById(taskId)
    if (!task) {
      throw new Error('任务不存在')
    }

    if (task.status !== TaskStatus.IN_PROGRESS) {
      throw new Error('当前任务状态不允许完成')
    }

    if (task.escortId !== escortId) {
      throw new Error('只能完成分配给自己的任务')
    }

    const now = Date.now()
    task.status = TaskStatus.COMPLETED
    task.completedAt = now

    if (task.startedAt) {
      const serviceTimeMs = now - task.startedAt
      task.serviceTimeMinutes = Math.round(serviceTimeMs / 60000)
    }

    const escort = storage.getEscortById(escortId)
    if (escort) {
      escort.status = 'available'
      escort.currentTaskId = undefined
      storage.saveEscort(escort)
    }

    storage.saveTask(task)
    
    storage.saveIdempotencyRecord({
      key,
      taskId: task.id,
      operation: 'complete',
      createdAt: now
    })

    logger.info('任务完成', { taskId, escortId })
    return task
  }

  public cancelTask(taskId: string, reason: string, operator: string, idempotencyKey?: string): Task {
    const key = idempotencyKey || this.generateIdempotencyKey('cancel', { taskId, reason })
    
    const existingTask = this.checkIdempotency(key)
    if (existingTask) {
      return existingTask
    }

    const task = storage.getTaskById(taskId)
    if (!task) {
      throw new Error('任务不存在')
    }

    if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELLED) {
      throw new Error('当前任务状态不允许取消')
    }

    const now = Date.now()
    task.status = TaskStatus.CANCELLED
    task.cancelledAt = now
    task.remarks = task.remarks ? `${task.remarks} | 取消原因: ${reason}` : `取消原因: ${reason}`

    if (task.escortId) {
      const escort = storage.getEscortById(task.escortId)
      if (escort) {
        escort.status = 'available'
        escort.currentTaskId = undefined
        storage.saveEscort(escort)
      }
    }

    storage.saveTask(task)
    
    storage.saveIdempotencyRecord({
      key,
      taskId: task.id,
      operation: 'cancel',
      createdAt: now
    })

    logger.info('任务已取消', { taskId, operator })
    return task
  }

  public timeoutTask(taskId: string, idempotencyKey?: string): Task {
    const key = idempotencyKey || this.generateIdempotencyKey('timeout', { taskId })
    
    const existingTask = this.checkIdempotency(key)
    if (existingTask) {
      return existingTask
    }

    const task = storage.getTaskById(taskId)
    if (!task) {
      throw new Error('任务不存在')
    }

    if (task.status !== TaskStatus.PENDING && task.status !== TaskStatus.ASSIGNED) {
      throw new Error('当前任务状态不能标记为超时')
    }

    const now = Date.now()
    task.status = TaskStatus.TIMEOUT
    task.timeoutAt = now

    if (task.escortId) {
      const escort = storage.getEscortById(task.escortId)
      if (escort) {
        escort.status = 'available'
        escort.currentTaskId = undefined
        storage.saveEscort(escort)
      }
    }

    storage.saveTask(task)
    
    storage.saveIdempotencyRecord({
      key,
      taskId: task.id,
      operation: 'timeout',
      createdAt: now
    })

    logger.warn('任务已超时', { taskId })
    return task
  }

  public getTaskById(taskId: string): Task | undefined {
    return storage.getTaskById(taskId)
  }

  public getTasksByStatus(status: TaskStatus): Task[] {
    return storage.getTasks().filter(t => t.status === status)
  }

  public getTasksByEscort(escortId: string): Task[] {
    return storage.getTasks().filter(t => t.escortId === escortId)
  }

  public getAllTasks(): Task[] {
    return storage.getTasks()
  }

  public getStatistics(startTime?: number, endTime?: number): TaskStats {
    let tasks = storage.getTasks()

    if (startTime) {
      tasks = tasks.filter(t => t.createdAt >= startTime)
    }
    if (endTime) {
      tasks = tasks.filter(t => t.createdAt <= endTime)
    }

    const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED)
    const waitTimes = completedTasks
      .map(t => t.waitTimeMinutes || 0)
      .filter(t => t > 0)
    const serviceTimes = completedTasks
      .map(t => t.serviceTimeMinutes || 0)
      .filter(t => t > 0)

    const tasksByEscort: Record<string, { name: string; completed: number; inProgress: number }> = {}
    for (const escort of storage.getEscorts()) {
      const escortTasks = tasks.filter(t => t.escortId === escort.id)
      tasksByEscort[escort.id] = {
        name: escort.name,
        completed: escortTasks.filter(t => t.status === TaskStatus.COMPLETED).length,
        inProgress: escortTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length
      }
    }

    return {
      totalTasks: tasks.length,
      pendingTasks: tasks.filter(t => t.status === TaskStatus.PENDING).length,
      inProgressTasks: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length,
      completedTasks: completedTasks.length,
      cancelledTasks: tasks.filter(t => t.status === TaskStatus.CANCELLED).length,
      timeoutTasks: tasks.filter(t => t.status === TaskStatus.TIMEOUT).length,
      avgWaitTimeMinutes: waitTimes.length > 0 
        ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length * 100) / 100
        : 0,
      avgServiceTimeMinutes: serviceTimes.length > 0
        ? Math.round(serviceTimes.reduce((a, b) => a + b, 0) / serviceTimes.length * 100) / 100
        : 0,
      maxWaitTimeMinutes: waitTimes.length > 0 ? Math.max(...waitTimes) : 0,
      tasksByPriority: {
        [TaskPriority.NORMAL]: tasks.filter(t => t.priority === TaskPriority.NORMAL).length,
        [TaskPriority.URGENT]: tasks.filter(t => t.priority === TaskPriority.URGENT).length,
        [TaskPriority.EMERGENCY]: tasks.filter(t => t.priority === TaskPriority.EMERGENCY).length
      },
      tasksByEscort
    }
  }

  public cleanupExpiredIdempotencyRecords(): number {
    return storage.clearExpiredIdempotencyRecords()
  }
}

export const taskService = new TaskService()
