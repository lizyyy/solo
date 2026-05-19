import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from '../models/AuditLog';
import { AppDataSource } from '../database/data-source';
import { logger } from '../utils/logger';

export class AuditService {
  private auditLogRepository: Repository<AuditLog>;

  constructor() {
    this.auditLogRepository = AppDataSource.getRepository(AuditLog);
  }

  async createLog(
    action: AuditAction,
    entityType: string,
    options: {
      entityId?: string;
      batchNumber?: string;
      beforeData?: Record<string, any>;
      afterData?: Record<string, any>;
      operator?: string;
      operatorRole?: string;
      remark?: string;
      ipAddress?: string;
      requestId?: string;
    }
  ): Promise<AuditLog> {
    const log = this.auditLogRepository.create({
      action,
      entityType,
      entityId: options.entityId,
      batchNumber: options.batchNumber,
      beforeData: options.beforeData,
      afterData: options.afterData,
      changes: this.calculateChanges(options.beforeData, options.afterData),
      operator: options.operator,
      operatorRole: options.operatorRole,
      remark: options.remark,
      ipAddress: options.ipAddress,
      requestId: options.requestId,
    });

    const savedLog = await this.auditLogRepository.save(log);
    logger.info(`Audit log created: ${action} ${entityType}`, {
      entityId: options.entityId,
      batchNumber: options.batchNumber,
      requestId: options.requestId,
    });

    return savedLog;
  }

  private calculateChanges(before?: Record<string, any>, after?: Record<string, any>): string | undefined {
    if (!before || !after) return undefined;

    const changes: string[] = [];
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
      const beforeVal = JSON.stringify(before[key]);
      const afterVal = JSON.stringify(after[key]);
      if (beforeVal !== afterVal) {
        changes.push(`${key}: ${beforeVal} -> ${afterVal}`);
      }
    }

    return changes.length > 0 ? changes.join('; ') : undefined;
  }

  async getLogs(filters: {
    action?: AuditAction;
    entityType?: string;
    batchNumber?: string;
    operator?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
  }): Promise<{ data: AuditLog[]; total: number }> {
    const { page = 1, pageSize = 20, ...whereFilters } = filters;

    let query = this.auditLogRepository
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC');

    if (whereFilters.action) {
      query = query.andWhere('log.action = :action', { action: whereFilters.action });
    }
    if (whereFilters.entityType) {
      query = query.andWhere('log.entityType = :entityType', { entityType: whereFilters.entityType });
    }
    if (whereFilters.batchNumber) {
      query = query.andWhere('log.batchNumber = :batchNumber', { batchNumber: whereFilters.batchNumber });
    }
    if (whereFilters.operator) {
      query = query.andWhere('log.operator = :operator', { operator: whereFilters.operator });
    }
    if (whereFilters.startDate) {
      query = query.andWhere('log.createdAt >= :startDate', { startDate: whereFilters.startDate });
    }
    if (whereFilters.endDate) {
      query = query.andWhere('log.createdAt <= :endDate', { endDate: whereFilters.endDate });
    }

    const [data, total] = await query
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { data, total };
  }
}

export const auditService = new AuditService();
