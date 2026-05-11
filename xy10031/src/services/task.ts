import { db } from './database'
import { logger } from './logger'
import { syncService } from './sync'

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

const STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  PENDING: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'IN_PROGRESS'],
  APPROVED: [],
  REJECTED: ['IN_PROGRESS', 'CANCELLED'],
  CANCELLED: [],
}

class TaskService {
  canTransition(oldStatus: string, newStatus: string): boolean {
    const allowed = STATUS_TRANSITIONS[oldStatus as TaskStatus] || []
    return allowed.includes(newStatus as TaskStatus)
  }

  async listTasks(params: {
    status?: string
    assigneeId?: string
    keyword?: string
    skip?: number
    take?: number
  }) {
    const { status, assigneeId, keyword, skip = 0, take = 50 } = params

    const where: any = {}
    if (status) where.status = status
    if (assigneeId) where.assigneeId = assigneeId
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { description: { contains: keyword } },
      ]
    }

    const [tasks, total] = await Promise.all([
      db.inventoryTask.findMany({
        where,
        skip,
        take,
        include: {
          assignee: { select: { id: true, name: true } },
          _count: { select: { records: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.inventoryTask.count({ where }),
    ])

    return { tasks, total }
  }

  async getTaskById(id: string) {
    return db.inventoryTask.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true } },
        records: {
          include: {
            product: true,
            user: { select: { id: true, name: true } },
          },
        },
        history: { orderBy: { changedAt: 'asc' } },
      },
    })
  }

  async createTask(params: {
    name: string
    description?: string
    assigneeId?: string
    userId: string
  }) {
    const { userId, ...data } = params

    const task = await db.inventoryTask.create({
      data,
    })

    await db.taskHistory.create({
      data: {
        taskId: task.id,
        oldStatus: null,
        newStatus: 'PENDING',
        remark: '任务创建',
        changedBy: userId,
      },
    })

    await logger.info({
      userId,
      action: 'CREATE',
      module: 'TASK',
      details: { taskId: task.id, name: params.name },
    })

    await syncService.addToQueue({
      type: 'TASK_CREATE',
      payload: {
        type: 'TASK_CREATE',
        data: {
          id: task.id,
          name: params.name,
          description: params.description,
          assigneeId: params.assigneeId,
        }
      },
      userId,
      maxRetries: 5,
    })

    return task
  }

  async updateTaskStatus(params: {
    taskId: string
    newStatus: string
    remark?: string
    userId: string
  }) {
    const { taskId, newStatus, remark, userId } = params

    const task = await db.inventoryTask.findUnique({
      where: { id: taskId },
    })

    if (!task) {
      throw new Error('任务不存在')
    }

    if (!this.canTransition(task.status, newStatus)) {
      throw new Error(`状态流转不合法: ${task.status} -> ${newStatus}`)
    }

    const updateData: any = { status: newStatus }

    if (newStatus === 'IN_PROGRESS' && !task.startedAt) {
      updateData.startedAt = new Date()
    }
    if (newStatus === 'APPROVED' && !task.completedAt) {
      updateData.completedAt = new Date()
    }

    const updatedTask = await db.inventoryTask.update({
      where: { id: taskId },
      data: updateData,
    })

    await db.taskHistory.create({
      data: {
        taskId,
        oldStatus: task.status,
        newStatus,
        remark,
        changedBy: userId,
      },
    })

    await logger.info({
      userId,
      action: 'STATUS_CHANGE',
      module: 'TASK',
      details: {
        taskId,
        from: task.status,
        to: newStatus,
        remark,
      },
    })

    await syncService.addToQueue({
      type: 'TASK_STATUS_CHANGE',
      payload: {
        type: 'TASK_STATUS_CHANGE',
        data: {
          taskId,
          fromStatus: task.status,
          toStatus: newStatus,
          remark,
          startedAt: newStatus === 'IN_PROGRESS' ? new Date().toISOString() : null,
          completedAt: newStatus === 'APPROVED' ? new Date().toISOString() : null,
        }
      },
      userId,
      maxRetries: 5,
    })

    return updatedTask
  }

  async assignTask(taskId: string, assigneeId: string, userId: string) {
    const task = await db.inventoryTask.update({
      where: { id: taskId },
      data: { assigneeId },
    })

    await logger.info({
      userId,
      action: 'ASSIGN',
      module: 'TASK',
      details: { taskId, assigneeId },
    })

    await syncService.addToQueue({
      type: 'TASK_ASSIGN',
      payload: {
        type: 'TASK_ASSIGN',
        data: {
          taskId,
          assigneeId,
        }
      },
      userId,
      maxRetries: 5,
    })

    return task
  }

  async addInventoryRecord(params: {
    taskId: string
    productId: string
    userId: string
    expectedQty: number
    actualQty: number
    remark?: string
  }) {
    const { taskId, productId, userId } = params

    const existing = await db.inventoryRecord.findFirst({
      where: { taskId, productId },
    })

    const record = existing
      ? await db.inventoryRecord.update({
          where: { id: existing.id },
          data: {
            userId,
            expectedQty: params.expectedQty,
            actualQty: params.actualQty,
            difference: params.actualQty - params.expectedQty,
            remark: params.remark,
          },
        })
      : await db.inventoryRecord.create({
          data: {
            taskId,
            productId,
            userId,
            expectedQty: params.expectedQty,
            actualQty: params.actualQty,
            difference: params.actualQty - params.expectedQty,
            remark: params.remark,
          },
        })

    await logger.info({
      userId,
      action: 'RECORD',
      module: 'INVENTORY_TASK',
      details: {
        taskId,
        productId,
        expectedQty: params.expectedQty,
        actualQty: params.actualQty,
      },
    })

    await syncService.addToQueue({
      type: 'INVENTORY_RECORD',
      payload: {
        type: 'INVENTORY_RECORD',
        data: {
          id: record.id,
          taskId,
          productId,
          expectedQty: params.expectedQty,
          actualQty: params.actualQty,
          difference: params.actualQty - params.expectedQty,
          remark: params.remark,
          isUpdate: !!existing,
        }
      },
      userId,
      maxRetries: 5,
    })

    return record
  }

  async batchAddRecords(taskId: string, items: Omit<Parameters<typeof this.addInventoryRecord>[0], 'taskId'>[]) {
    const results = []
    for (const item of items) {
      const result = await this.addInventoryRecord({
        taskId,
        ...item,
      })
      results.push(result)
    }
    return results
  }

  async getTaskHistory(taskId: string) {
    return db.taskHistory.findMany({
      where: { taskId },
      orderBy: { changedAt: 'asc' },
    })
  }

  async getTaskStatistics(taskId: string) {
    const records = await db.inventoryRecord.findMany({
      where: { taskId },
    })

    const total = records.length
    const positiveDiff = records.filter(r => r.difference > 0).length
    const negativeDiff = records.filter(r => r.difference < 0).length
    const matched = records.filter(r => r.difference === 0).length
    const totalDifference = records.reduce((sum, r) => sum + r.difference, 0)

    return {
      total,
      matched,
      positiveDiff,
      negativeDiff,
      totalDifference,
    }
  }
}

export const taskService = new TaskService()
