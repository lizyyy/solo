import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditOperation, AuditEntity, AuditLog } from '@prisma/client';

export interface AuditLogData {
  requestId?: string;
  operation: AuditOperation;
  entity: AuditEntity;
  entityId?: string;
  entityName?: string;
  beforeSnapshot?: any;
  afterSnapshot?: any;
  changedFields?: string[];
  userId?: string;
  operatorName?: string;
  ipAddress?: string;
  userAgent?: string;
  remark?: string;
  parentLogId?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prismaService: PrismaService) {}

  async log(data: AuditLogData): Promise<AuditLog> {
    try {
      let changedFields = data.changedFields;
      
      if (!changedFields && data.beforeSnapshot && data.afterSnapshot) {
        changedFields = this.findChangedFields(
          data.beforeSnapshot,
          data.afterSnapshot,
        );
      }

      const auditLog = await this.prismaService.auditLog.create({
        data: {
          requestId: data.requestId,
          operation: data.operation,
          entity: data.entity,
          entityId: data.entityId,
          entityName: data.entityName,
          beforeSnapshot: data.beforeSnapshot as any,
          afterSnapshot: data.afterSnapshot as any,
          changedFields: changedFields as any,
          userId: data.userId,
          operatorName: data.operatorName,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          remark: data.remark,
          parentLogId: data.parentLogId,
        },
      });

      this.logger.debug(
        `审计日志已记录: ${data.operation} ${data.entity}`,
      );

      return auditLog;
    } catch (error) {
      this.logger.error('记录审计日志失败', error.stack);
      throw error;
    }
  }

  async logBatch(logs: AuditLogData[]): Promise<AuditLog[]> {
    return this.prismaService.$transaction(async (prisma) => {
      const createdLogs: AuditLog[] = [];

      for (const log of logs) {
        const created = await prisma.auditLog.create({
          data: {
            requestId: log.requestId,
            operation: log.operation,
            entity: log.entity,
            entityId: log.entityId,
            entityName: log.entityName,
            beforeSnapshot: log.beforeSnapshot as any,
            afterSnapshot: log.afterSnapshot as any,
            changedFields: log.changedFields as any,
            userId: log.userId,
            operatorName: log.operatorName,
            ipAddress: log.ipAddress,
            userAgent: log.userAgent,
            remark: log.remark,
            parentLogId: log.parentLogId,
          },
        });
        createdLogs.push(created);
      }

      return createdLogs;
    });
  }

  async findById(id: string): Promise<AuditLog | null> {
    return this.prismaService.auditLog.findUnique({
      where: { id },
      include: {
        childLogs: true,
        user: {
          select: { id: true, name: true, username: true },
        },
      },
    });
  }

  async findByRequestId(requestId: string): Promise<AuditLog[]> {
    return this.prismaService.auditLog.findMany({
      where: { requestId },
      orderBy: { timestamp: 'asc' },
      include: {
        childLogs: true,
        user: {
          select: { id: true, name: true, username: true },
        },
      },
    });
  }

  async findByEntity(
    entity: AuditEntity,
    entityId: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const [logs, total] = await Promise.all([
      this.prismaService.auditLog.findMany({
        where: { entity, entityId },
        orderBy: { timestamp: 'desc' },
        skip: offset,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, username: true },
          },
        },
      }),
      this.prismaService.auditLog.count({ where: { entity, entityId } }),
    ]);

    return { logs, total };
  }

  async findByUser(
    userId: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const [logs, total] = await Promise.all([
      this.prismaService.auditLog.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        skip: offset,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, username: true },
          },
        },
      }),
      this.prismaService.auditLog.count({ where: { userId } }),
    ]);

    return { logs, total };
  }

  async query(
    filters: {
      operation?: AuditOperation;
      entity?: AuditEntity;
      entityId?: string;
      userId?: string;
      startTime?: Date;
      endTime?: Date;
      keyword?: string;
    },
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const where: any = {};

    if (filters.operation) where.operation = filters.operation;
    if (filters.entity) where.entity = filters.entity;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.startTime || filters.endTime) {
      where.timestamp = {};
      if (filters.startTime) where.timestamp.gte = filters.startTime;
      if (filters.endTime) where.timestamp.lte = filters.endTime;
    }
    if (filters.keyword) {
      where.OR = [
        { entityName: { contains: filters.keyword } },
        { operatorName: { contains: filters.keyword } },
        { remark: { contains: filters.keyword } },
      ];
    }

    const [logs, total] = await Promise.all([
      this.prismaService.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: offset,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, username: true },
          },
        },
      }),
      this.prismaService.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  async replayOperation(logId: string): Promise<any> {
    const log = await this.findById(logId);
    if (!log) {
      throw new Error('审计日志不存在');
    }

    return {
      id: log.id,
      requestId: log.requestId,
      operation: log.operation,
      entity: log.entity,
      entityId: log.entityId,
      entityName: log.entityName,
      beforeSnapshot: log.beforeSnapshot,
      afterSnapshot: log.afterSnapshot,
      changedFields: log.changedFields,
      userId: log.userId,
      operatorName: log.operatorName,
      timestamp: log.timestamp,
      remark: log.remark,
    };
  }

  async replayRequest(requestId: string): Promise<any[]> {
    const logs = await this.findByRequestId(requestId);
    return logs.map((log) => ({
      id: log.id,
      requestId: log.requestId,
      operation: log.operation,
      entity: log.entity,
      entityId: log.entityId,
      entityName: log.entityName,
      beforeSnapshot: log.beforeSnapshot,
      afterSnapshot: log.afterSnapshot,
      changedFields: log.changedFields,
      userId: log.userId,
      operatorName: log.operatorName,
      timestamp: log.timestamp,
      remark: log.remark,
    }));
  }

  async getEntityHistory(
    entity: AuditEntity,
    entityId: string,
  ): Promise<any[]> {
    const { logs } = await this.findByEntity(entity, entityId, 1000, 0);
    
    return logs.map((log) => ({
      version: log.id,
      timestamp: log.timestamp,
      operator: log.operatorName,
      operation: log.operation,
      snapshot: log.afterSnapshot,
      changedFields: log.changedFields,
      remark: log.remark,
    }));
  }

  async getEntityAtPointInTime(
    entity: AuditEntity,
    entityId: string,
    timestamp: Date,
  ): Promise<any | null> {
    const logs = await this.prismaService.auditLog.findMany({
      where: {
        entity,
        entityId,
        timestamp: {
          lte: timestamp,
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 1,
    });

    if (logs.length === 0) {
      return null;
    }

    return {
      ...logs[0].afterSnapshot,
      timestamp: logs[0].timestamp,
    };
  }

  async getOperationSummary(
    entity: AuditEntity,
    entityId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalOperations: number;
    operationBreakdown: Record<AuditOperation, number>;
    uniqueOperators: number;
    fieldChanges: Record<string, number>;
  }> {
    const logs = await this.prismaService.auditLog.findMany({
      where: {
        entity,
        entityId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const operationBreakdown: Record<string, number> = {};
    const operatorSet = new Set<string>();
    const fieldChanges: Record<string, number> = {};

    logs.forEach((log) => {
      operationBreakdown[log.operation] = (operationBreakdown[log.operation] || 0) + 1;
      
      if (log.operatorName) {
        operatorSet.add(log.operatorName);
      }

      if (log.changedFields && Array.isArray(log.changedFields)) {
        (log.changedFields as string[]).forEach((field) => {
          fieldChanges[field] = (fieldChanges[field] || 0) + 1;
        });
      }
    });

    return {
      totalOperations: logs.length,
      operationBreakdown: operationBreakdown as any,
      uniqueOperators: operatorSet.size,
      fieldChanges,
    };
  }

  private findChangedFields(before: any, after: any): string[] {
    const changedFields: string[] = [];
    const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

    for (const key of allKeys) {
      const beforeValue = before?.[key];
      const afterValue = after?.[key];

      if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
        changedFields.push(key);
      }
    }

    return changedFields;
  }
}
