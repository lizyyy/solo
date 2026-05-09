import { db } from './database'
import { TaskStatus } from '@prisma/client'
import { logger } from './logger'

const STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.PENDING]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
  [TaskStatus.IN_PROGRESS]: [
    TaskStatus.PENDING_APPROVAL,
    TaskStatus.CANCELLED,
  ],
  [TaskStatus.PENDING_APPROVAL]: [
    TaskStatus.APPROVED,
    TaskStatus.REJECTED,
    TaskStatus.IN_PROGRESS,
  ],
  [TaskStatus.APPROVED]: [],
  [TaskStatus.REJECTED]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
  [TaskStatus.CANCELLED]: [],
}

class TaskService {
  canTransition(oldStatus: TaskStatus, newStatus: TaskStatus): boolean {
    const allowed = STATUS_TRANSITIONS[oldStatus] || []
    return allowed.includes(newStatus)
  }

  async listTasks(params: {
    status?: TaskStatus
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
        newStatus: TaskStatus.PENDING,
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

    return task
  }

  async updateTaskStatus(params: {
    taskId: string
    newStatus: TaskStatus
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

    if (newStatus === TaskStatus.IN_PROGRESS && !task.startedAt) {
      updateData.startedAt = new Date()
    }
    if (newStatus === TaskStatus.APPROVED && !task.completedAt) {
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
