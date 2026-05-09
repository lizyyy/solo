import { AuditAction, EntityType, PrismaClient, TaskStatus, TaskPriority } from '@prisma/client';
import { prisma, transaction } from '../config/database';
import { RequestContext, logger } from '../utils/logger';
import { auditService } from './AuditService';
import { lockService, VersionConflictError } from './LockService';
import { outboxService } from './OutboxService';
import { redis } from '../config/redis';

export interface CreateTaskData {
  customerId: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId?: string;
  dueDate?: Date;
  orderNumber?: string;
  trackingNumber?: string;
  refundAmount?: number;
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: Date | null;
  orderNumber?: string | null;
  trackingNumber?: string | null;
  refundAmount?: number | null;
  expectedVersion: number;
}

export class TaskService {
  private readonly cachePrefix = 'task:';
  private readonly cacheTTL = 60;

  async createTask(
    data: CreateTaskData,
    context: RequestContext
  ) {
    if (!context.userId) {
      throw new Error('User ID is required');
    }

    return transaction(async (tx) => {
      const existingTask = await tx.task.findFirst({
        where: {
          customerId: data.customerId,
          orderNumber: data.orderNumber,
          deletedAt: null,
        },
      });

      if (existingTask && data.orderNumber) {
        return {
          isDuplicate: true,
          task: existingTask,
        };
      }

      const task = await tx.task.create({
        data: {
          customerId: data.customerId,
          title: data.title,
          description: data.description,
          priority: data.priority || TaskPriority.MEDIUM,
          assigneeId: data.assigneeId,
          creatorId: context.userId!,
          dueDate: data.dueDate,
          orderNumber: data.orderNumber,
          trackingNumber: data.trackingNumber,
          refundAmount: data.refundAmount,
          version: 1,
        },
        include: {
          customer: true,
          creator: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.taskVersion.create({
        data: {
          taskId: task.id,
          versionNumber: 1,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          assigneeId: task.assigneeId,
          dueDate: task.dueDate,
          orderNumber: task.orderNumber,
          trackingNumber: task.trackingNumber,
          refundAmount: task.refundAmount,
          snapshotData: task as any,
          createdBy: context.userId!,
        },
      });

      await auditService.record(
        {
          entityType: EntityType.TASK,
          entityId: task.id,
          action: AuditAction.CREATE,
          newState: task,
        },
        context,
        tx
      );

      await outboxService.enqueueEvent(
        {
          aggregateType: 'Task',
          aggregateId: task.id,
          eventType: 'TaskCreated',
          payload: {
            taskId: task.id,
            customerId: task.customerId,
            creatorId: task.creatorId,
          },
        },
        tx
      );

      return {
        isDuplicate: false,
        task,
      };
    });
  }

  async updateTask(
    taskId: string,
    data: UpdateTaskData,
    context: RequestContext
  ) {
    if (!context.userId) {
      throw new Error('User ID is required');
    }

    const { expectedVersion, ...updateData } = data;

    return transaction(async (tx) => {
      await lockService.checkVersion(EntityType.TASK, taskId, expectedVersion, tx);

      const existingTask = await tx.task.findUnique({
        where: { id: taskId, deletedAt: null },
      });

      if (!existingTask) {
        throw new Error('Task not found');
      }

      const newVersion = expectedVersion + 1;

      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          ...updateData,
          version: newVersion,
          completedAt: updateData.status === TaskStatus.COMPLETED && existingTask.status !== TaskStatus.COMPLETED
            ? new Date()
            : existingTask.completedAt,
        },
        include: {
          customer: true,
          creator: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.taskVersion.create({
        data: {
          taskId: updatedTask.id,
          versionNumber: newVersion,
          title: updatedTask.title,
          description: updatedTask.description,
          status: updatedTask.status,
          priority: updatedTask.priority,
          assigneeId: updatedTask.assigneeId,
          dueDate: updatedTask.dueDate,
          orderNumber: updatedTask.orderNumber,
          trackingNumber: updatedTask.trackingNumber,
          refundAmount: updatedTask.refundAmount,
          snapshotData: updatedTask as any,
          createdBy: context.userId!,
        },
      });

      const changes = this.getChanges(existingTask, updateData);
      await auditService.record(
        {
          entityType: EntityType.TASK,
          entityId: taskId,
          action: AuditAction.UPDATE,
          previousState: existingTask,
          newState: changes,
        },
        context,
        tx
      );

      await outboxService.enqueueEvent(
        {
          aggregateType: 'Task',
          aggregateId: taskId,
          eventType: 'TaskUpdated',
          payload: {
            taskId,
            changes,
            updatedBy: context.userId,
          },
        },
        tx
      );

      await this.invalidateCache(taskId);

      return updatedTask;
    });
  }

  async getTask(taskId: string, useCache: boolean = true) {
    if (useCache) {
      const cached = await this.getFromCache(taskId);
      if (cached) {
        return cached;
      }
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId, deletedAt: null },
      include: {
        customer: true,
        creator: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        notes: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (task && useCache) {
      await this.setCache(task);
    }

    return task;
  }

  async getTaskVersions(taskId: string) {
    return prisma.taskVersion.findMany({
      where: { taskId },
      orderBy: { versionNumber: 'desc' },
      include: {
        task: true,
      },
    });
  }

  async rollbackToVersion(
    taskId: string,
    targetVersionNumber: number,
    context: RequestContext,
    reason: string = '数据回滚'
  ) {
    if (!context.userId) {
      throw new Error('User ID is required');
    }

    return transaction(async (tx) => {
      const currentTask = await tx.task.findUnique({
        where: { id: taskId, deletedAt: null },
      });

      if (!currentTask) {
        throw new Error('Task not found');
      }

      const targetVersion = await tx.taskVersion.findUnique({
        where: {
          taskId_versionNumber: {
            taskId,
            versionNumber: targetVersionNumber,
          },
        },
      });

      if (!targetVersion) {
        throw new Error('Target version not found');
      }

      const newVersion = currentTask.version + 1;

      const rolledBackTask = await tx.task.update({
        where: { id: taskId },
        data: {
          title: targetVersion.title,
          description: targetVersion.description,
          status: targetVersion.status,
          priority: targetVersion.priority,
          assigneeId: targetVersion.assigneeId,
          dueDate: targetVersion.dueDate,
          orderNumber: targetVersion.orderNumber,
          trackingNumber: targetVersion.trackingNumber,
          refundAmount: targetVersion.refundAmount,
          version: newVersion,
        },
        include: {
          customer: true,
          creator: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.taskVersion.create({
        data: {
          taskId: rolledBackTask.id,
          versionNumber: newVersion,
          title: rolledBackTask.title,
          description: rolledBackTask.description,
          status: rolledBackTask.status,
          priority: rolledBackTask.priority,
          assigneeId: rolledBackTask.assigneeId,
          dueDate: rolledBackTask.dueDate,
          orderNumber: rolledBackTask.orderNumber,
          trackingNumber: rolledBackTask.trackingNumber,
          refundAmount: rolledBackTask.refundAmount,
          snapshotData: rolledBackTask as any,
          createdBy: context.userId!,
        },
      });

      await auditService.record(
        {
          entityType: EntityType.TASK,
          entityId: taskId,
          action: AuditAction.ROLLBACK,
          previousState: currentTask,
          newState: rolledBackTask,
          reason,
        },
        context,
        tx
      );

      await this.invalidateCache(taskId);

      return rolledBackTask;
    });
  }

  async deleteTask(
    taskId: string,
    context: RequestContext,
    reason?: string
  ) {
    if (!context.userId) {
      throw new Error('User ID is required');
    }

    return transaction(async (tx) => {
      const task = await tx.task.findUnique({
        where: { id: taskId, deletedAt: null },
      });

      if (!task) {
        throw new Error('Task not found');
      }

      await tx.task.update({
        where: { id: taskId },
        data: {
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });

      await auditService.record(
        {
          entityType: EntityType.TASK,
          entityId: taskId,
          action: AuditAction.DELETE,
          previousState: task,
          reason,
        },
        context,
        tx
      );

      await this.invalidateCache(taskId);

      return true;
    });
  }

  async listTasks(filters: {
    status?: TaskStatus[];
    priority?: TaskPriority[];
    assigneeId?: string;
    customerId?: string;
    page?: number;
    pageSize?: number;
    search?: string;
  }) {
    const { page = 1, pageSize = 20, ...whereFilters } = filters;
    const skip = (page - 1) * pageSize;

    const where: any = { deletedAt: null };

    if (whereFilters.status?.length) {
      where.status = { in: whereFilters.status };
    }

    if (whereFilters.priority?.length) {
      where.priority = { in: whereFilters.priority };
    }

    if (whereFilters.assigneeId) {
      where.assigneeId = whereFilters.assigneeId;
    }

    if (whereFilters.customerId) {
      where.customerId = whereFilters.customerId;
    }

    if (whereFilters.search) {
      where.OR = [
        { title: { contains: whereFilters.search, mode: 'insensitive' } },
        { description: { contains: whereFilters.search, mode: 'insensitive' } },
        { orderNumber: { contains: whereFilters.search, mode: 'insensitive' } },
      ];
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: pageSize,
        include: {
          customer: true,
          creator: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
          _count: {
            select: { notes: { where: { deletedAt: null } } },
          },
        },
      }),
      prisma.task.count({ where }),
    ]);

    return {
      tasks,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  private getChanges(original: any, updates: any): Record<string, unknown> {
    const changes: Record<string, unknown> = {};

    for (const key of Object.keys(updates)) {
      if (original[key] !== updates[key]) {
        changes[key] = updates[key];
      }
    }

    return changes;
  }

  private async getFromCache(taskId: string) {
    try {
      const cached = await redis.get(`${this.cachePrefix}${taskId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.warn('Cache get failed', { error: (error as Error).message });
      return null;
    }
  }

  private async setCache(task: any) {
    try {
      await redis.set(
        `${this.cachePrefix}${task.id}`,
        JSON.stringify(task),
        'EX',
        this.cacheTTL
      );
    } catch (error) {
      logger.warn('Cache set failed', { error: (error as Error).message });
    }
  }

  private async invalidateCache(taskId: string) {
    try {
      await redis.del(`${this.cachePrefix}${taskId}`);
    } catch (error) {
      logger.warn('Cache invalidation failed', { error: (error as Error).message });
    }
  }
}

export const taskService = new TaskService();