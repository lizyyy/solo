import { prisma } from '../config/database';

interface AuditLogInput {
  actionType: string;
  entityType: string;
  entityId?: string;
  operatorId: string;
  operatorName: string;
  beforeValue?: Record<string, unknown>;
  afterValue?: Record<string, unknown>;
  requestData?: Record<string, unknown>;
  responseData?: Record<string, unknown>;
}

export const auditService = {
  async createLog(input: AuditLogInput) {
    return prisma.auditLog.create({
      data: {
        actionType: input.actionType,
        entityType: input.entityType,
        entityId: input.entityId,
        operatorId: input.operatorId,
        operatorName: input.operatorName,
        beforeValue: input.beforeValue,
        afterValue: input.afterValue,
        requestData: input.requestData,
        responseData: input.responseData,
      },
    });
  },

  async getLogsByEntity(entityType: string, entityId: string) {
    return prisma.auditLog.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getLogsByOperator(operatorId: string, limit: number = 50) {
    return prisma.auditLog.findMany({
      where: { operatorId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },
};
