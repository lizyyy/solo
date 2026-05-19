import { AppDataSource } from '../database/data-source';
import { AuditLog, AuditAction, AuditEntity } from '../entities/AuditLog';

export interface AuditContext {
  operator: string;
  operatorRole: string;
}

export class AuditService {
  private static get repository() {
    return AppDataSource.getRepository(AuditLog);
  }

  static async log(
    action: AuditAction,
    entity: AuditEntity,
    context: AuditContext,
    options: {
      entityId?: string;
      beforeData?: any;
      afterData?: any;
      reason?: string;
      success?: boolean;
      errorMessage?: string;
    } = {}
  ): Promise<AuditLog> {
    const log = this.repository.create({
      action,
      entity,
      entityId: options.entityId,
      beforeData: options.beforeData ? JSON.stringify(options.beforeData) : undefined,
      afterData: options.afterData ? JSON.stringify(options.afterData) : undefined,
      reason: options.reason,
      operator: context.operator,
      operatorRole: context.operatorRole,
      success: options.success ?? true,
      errorMessage: options.errorMessage
    });

    return await this.repository.save(log);
  }

  static async logCreate(entity: AuditEntity, entityId: string, afterData: any, context: AuditContext): Promise<AuditLog> {
    return this.log(AuditAction.CREATE, entity, context, {
      entityId,
      afterData,
      success: true
    });
  }

  static async logUpdate(entity: AuditEntity, entityId: string, beforeData: any, afterData: any, context: AuditContext, reason?: string): Promise<AuditLog> {
    return this.log(AuditAction.UPDATE, entity, context, {
      entityId,
      beforeData,
      afterData,
      reason,
      success: true
    });
  }

  static async logDelete(entity: AuditEntity, entityId: string, beforeData: any, context: AuditContext, reason?: string): Promise<AuditLog> {
    return this.log(AuditAction.DELETE, entity, context, {
      entityId,
      beforeData,
      reason,
      success: true
    });
  }

  static async logRuleCheck(entity: AuditEntity, entityId: string, passed: boolean, reason: string, context: AuditContext): Promise<AuditLog> {
    return this.log(
      passed ? AuditAction.RULE_CHECK_PASS : AuditAction.RULE_CHECK_BLOCK,
      entity,
      context,
      {
        entityId,
        reason,
        success: passed
      }
    );
  }

  static async logError(action: AuditAction, entity: AuditEntity, errorMessage: string, context: AuditContext, entityId?: string): Promise<AuditLog> {
    return this.log(action, entity, context, {
      entityId,
      success: false,
      errorMessage
    });
  }

  static async queryLogs(filters: {
    entity?: AuditEntity;
    action?: AuditAction;
    operator?: string;
    startDate?: Date;
    endDate?: Date;
    success?: boolean;
    entityId?: string;
  }): Promise<AuditLog[]> {
    const query = this.repository.createQueryBuilder('log');

    if (filters.entity) {
      query.andWhere('log.entity = :entity', { entity: filters.entity });
    }
    if (filters.action) {
      query.andWhere('log.action = :action', { action: filters.action });
    }
    if (filters.operator) {
      query.andWhere('log.operator LIKE :operator', { operator: `%${filters.operator}%` });
    }
    if (filters.startDate) {
      query.andWhere('log.operatedAt >= :startDate', { startDate: filters.startDate });
    }
    if (filters.endDate) {
      query.andWhere('log.operatedAt <= :endDate', { endDate: filters.endDate });
    }
    if (filters.success !== undefined) {
      query.andWhere('log.success = :success', { success: filters.success });
    }
    if (filters.entityId) {
      query.andWhere('log.entityId = :entityId', { entityId: filters.entityId });
    }

    query.orderBy('log.operatedAt', 'DESC');
    return await query.getMany();
  }
}