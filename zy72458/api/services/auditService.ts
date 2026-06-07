import { randomUUID } from 'crypto';
import { AuditLog, OperatorRole } from '../../shared/types.js';
import { dataSource } from '../data/dataSource.js';

export const auditService = {
  async createLog(params: {
    complaintId: string;
    action: string;
    operator: string;
    operatorRole: OperatorRole;
    beforeChange: Record<string, unknown> | null;
    afterChange: Record<string, unknown> | null;
  }): Promise<AuditLog> {
    const logs = await dataSource.getAuditLogs();
    const newLog: AuditLog = {
      id: randomUUID(),
      complaintId: params.complaintId,
      action: params.action,
      operator: params.operator,
      operatorRole: params.operatorRole,
      beforeChange: params.beforeChange,
      afterChange: params.afterChange,
      timestamp: new Date().toISOString(),
    };
    logs.push(newLog);
    await dataSource.saveAuditLogs(logs);
    return newLog;
  },

  async getLogsByComplaintId(complaintId: string): Promise<AuditLog[]> {
    const logs = await dataSource.getAuditLogs();
    return logs
      .filter(log => log.complaintId === complaintId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },

  async getAllLogs(): Promise<AuditLog[]> {
    const logs = await dataSource.getAuditLogs();
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },
};
