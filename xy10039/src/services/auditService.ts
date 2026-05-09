import { AuditLog } from '../models';
import { LogAction, LogEntity } from '../types';
import { auditLogger } from '../config/logger';

export class AuditService {
  static async log(
    action: LogAction,
    entity: LogEntity,
    entityId: string,
    userId?: string,
    oldValues?: object,
    newValues?: object,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      const logData = {
        action,
        entity,
        entityId,
        userId,
        oldValues,
        newValues,
        ipAddress,
        userAgent
      };

      await AuditLog.create(logData);

      auditLogger.info({
        ...logData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('审计日志写入失败:', error);
    }
  }

  static async getLogs(entity?: LogEntity, entityId?: string): Promise<AuditLog[]> {
    const where: any = {};
    if (entity) where.entity = entity;
    if (entityId) where.entityId = entityId;

    return AuditLog.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: 100
    });
  }
}
