import prisma from '../lib/prisma';

interface AuditLogData {
  tenantId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(data: AuditLogData): Promise<void> {
  await prisma.auditLog.create({
    data: {
      tenantId: data.tenantId,
      userId: data.userId,
      action: data.action,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      details: data.details ? JSON.stringify(data.details) : null,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    },
  });
}

export async function getAuditLogs(
  tenantId: string,
  options?: {
    userId?: string;
    action?: string;
    resourceType?: string;
    startTime?: Date;
    endTime?: Date;
    page?: number;
    pageSize?: number;
  }
) {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { tenantId };

  if (options?.userId) {
    where.userId = options.userId;
  }
  if (options?.action) {
    where.action = options.action;
  }
  if (options?.resourceType) {
    where.resourceType = options.resourceType;
  }
  if (options?.startTime || options?.endTime) {
    where.createdAt = {};
    if (options.startTime) {
      (where.createdAt as Record<string, unknown>).gte = options.startTime;
    }
    if (options.endTime) {
      (where.createdAt as Record<string, unknown>).lte = options.endTime;
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
