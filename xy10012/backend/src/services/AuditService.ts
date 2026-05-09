import { AuditAction, EntityType, PrismaClient } from '@prisma/client';
import { prisma } from '../config/database';
import { RequestContext } from '../utils/logger';

export interface AuditRecord {
  entityType: EntityType;
  entityId: string;
  action: AuditAction;
  previousState?: unknown;
  newState?: unknown;
  reason?: string;
}

export class AuditService {
  async record(
    record: AuditRecord,
    context: RequestContext,
    tx: PrismaClient = prisma
  ): Promise<void> {
    if (!context.userId) {
      throw new Error('User ID is required for audit');
    }

    await tx.auditLog.create({
      data: {
        entityType: record.entityType,
        entityId: record.entityId,
        action: record.action,
        previousState: record.previousState as any,
        newState: record.newState as any,
        userId: context.userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        reason: record.reason,
        requestId: context.requestId,
      },
    });
  }

  async getEntityHistory(
    entityType: EntityType,
    entityId: string,
    limit: number = 100,
    offset: number = 0
  ) {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          entityType,
          entityId,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { timestamp: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.auditLog.count({
        where: {
          entityType,
          entityId,
        },
      }),
    ]);

    return { logs, total };
  }

  async getUserActivity(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ) {
    const where: any = { userId };

    if (startDate && endDate) {
      where.timestamp = {
        gte: startDate,
        lte: endDate,
      };
    } else if (startDate) {
      where.timestamp = { gte: startDate };
    } else if (endDate) {
      where.timestamp = { lte: endDate };
    }

    return prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async replayEntityChanges(
    entityType: EntityType,
    entityId: string
  ): Promise<any[]> {
    const logs = await prisma.auditLog.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: { timestamp: 'asc' },
    });

    let currentState: any = {};
    const history: any[] = [];

    for (const log of logs) {
      if (log.action === AuditAction.CREATE) {
        currentState = log.newState as any;
      } else if (log.action === AuditAction.UPDATE) {
        currentState = { ...currentState, ...(log.newState as any) };
      } else if (log.action === AuditAction.DELETE) {
        currentState = { deleted: true, ...(log.previousState as any) };
      } else if (log.action === AuditAction.ROLLBACK) {
        currentState = log.newState as any;
      }

      history.push({
        timestamp: log.timestamp,
        action: log.action,
        userId: log.userId,
        state: { ...currentState },
      });
    }

    return history;
  }
}

export const auditService = new AuditService();