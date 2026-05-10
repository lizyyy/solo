import { AuditLogEntry, UUID } from '../types';
import { getAuditLogRepository } from '../repositories/RepositoryFactory';
import { generateId } from '../utils/idGenerator';

export class AuditService {
  private static instance: AuditService;

  private constructor() {}

  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  async logAction(
    action: string,
    resourceType: string,
    resourceId: UUID,
    options: {
      operator?: string;
      beforeState?: Record<string, any>;
      afterState?: Record<string, any>;
      reason?: string;
    } = {}
  ): Promise<AuditLogEntry> {
    const entry: AuditLogEntry = {
      id: generateId(),
      timestamp: new Date(),
      action,
      resourceType,
      resourceId,
      operator: options.operator,
      beforeState: options.beforeState,
      afterState: options.afterState,
      reason: options.reason,
    };

    return getAuditLogRepository().save(entry);
  }

  async getLogsByResource(resourceType: string, resourceId: UUID): Promise<AuditLogEntry[]> {
    const logs = await getAuditLogRepository().findByQuery({ resourceType, resourceId });
    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getLogsByAction(action: string): Promise<AuditLogEntry[]> {
    const logs = await getAuditLogRepository().findByQuery({ action });
    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getLogsByDateRange(startDate: Date, endDate: Date): Promise<AuditLogEntry[]> {
    const logs = await getAuditLogRepository().findAll();
    return logs
      .filter(log => log.timestamp >= startDate && log.timestamp <= endDate)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}
