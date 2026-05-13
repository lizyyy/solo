import { prisma } from '../config/database';
import { AuditLog } from '@prisma/client';

interface CreateAuditLogParams {
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
}

export const createAuditLog = async (params: CreateAuditLogParams): Promise<AuditLog> => {
  return prisma.auditLog.create({
    data: {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      oldValues: params.oldValues,
      newValues: params.newValues,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });
};

export const getAuditLogs = async (params: {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) => {
  const {
    entityType,
    entityId,
    userId,
    action,
    startDate,
    endDate,
    page = 1,
    limit = 50,
  } = params;

  const where: any = {};

  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (userId) where.userId = userId;
  if (action) where.action = action;

  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp.gte = new Date(startDate);
    if (endDate) where.timestamp.lte = new Date(endDate);
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getEntityTimeline = async (entityType: string, entityId: string) => {
  return prisma.auditLog.findMany({
    where: {
      entityType,
      entityId,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
        },
      },
    },
    orderBy: { timestamp: 'asc' },
  });
};
