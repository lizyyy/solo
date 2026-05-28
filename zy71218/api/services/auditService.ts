import { AuditLogDAO } from '../dao/index.js';
import type { AuditLog, PaginatedResponse, User } from '../../shared/types.js';

function generateId(): string {
  return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const auditService = {
  async logAction(
    userId: string,
    userName: string,
    action: string,
    targetType: string,
    targetId: string,
    detail: string,
    req?: any
  ): Promise<string> {
    if (!userId || !userName || !action || !targetType || !targetId) {
      throw new Error('缺少必要的审计日志参数');
    }

    const ipAddress = req?.ip || req?.connection?.remoteAddress || 'unknown';
    const userAgent = req?.headers?.['user-agent'] || 'unknown';

    const id = generateId();
    
    await AuditLogDAO.create({
      id,
      userId,
      userName,
      action,
      targetType,
      targetId,
      ipAddress,
      userAgent,
      detail,
    });

    return id;
  },

  async getAuditLogs(
    filters?: Record<string, any>,
    page: number = 1,
    pageSize: number = 10
  ): Promise<PaginatedResponse<AuditLog>> {
    if (page < 1) {
      throw new Error('页码必须大于0');
    }
    if (pageSize < 1 || pageSize > 100) {
      throw new Error('每页条数必须在1-100之间');
    }

    return await AuditLogDAO.list(filters, page, pageSize);
  },
};

export default auditService;
