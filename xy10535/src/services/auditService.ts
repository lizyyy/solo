import { store } from '../store';
import { generateId, now, calculateDiff } from '../utils';
import type { AuditLog } from '../types';

export class AuditService {
  log(
    options: {
      ticketId?: string;
      transferId?: string;
      refundId?: string;
      validationId?: string;
      operatorId: string;
      operatorName: string;
      action: string;
      beforeState?: Record<string, any> | null;
      afterState?: Record<string, any> | null;
      reason: string;
    }
  ): AuditLog {
    const beforeState = options.beforeState || null;
    const afterState = options.afterState || null;
    const diff = calculateDiff(beforeState, afterState);
    
    const log: AuditLog = {
      id: generateId(),
      ticketId: options.ticketId || null,
      transferId: options.transferId || null,
      refundId: options.refundId || null,
      validationId: options.validationId || null,
      operatorId: options.operatorId,
      operatorName: options.operatorName,
      action: options.action,
      beforeState,
      afterState,
      diff,
      reason: options.reason,
      timestamp: now()
    };
    
    store.saveAuditLog(log);
    return log;
  }

  findByTicketId(ticketId: string, limit: number = 100): AuditLog[] {
    return store.getAuditLogs()
      .filter(log => log.ticketId === ticketId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  findByOperatorId(operatorId: string, limit: number = 100): AuditLog[] {
    return store.getAuditLogs()
      .filter(log => log.operatorId === operatorId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  findByAction(action: string, limit: number = 100): AuditLog[] {
    return store.getAuditLogs()
      .filter(log => log.action === action)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  findAll(page: number = 1, pageSize: number = 50): { logs: AuditLog[]; total: number } {
    const all = store.getAuditLogs().sort((a, b) => b.timestamp - a.timestamp);
    const total = all.length;
    const offset = (page - 1) * pageSize;
    
    return {
      logs: all.slice(offset, offset + pageSize),
      total
    };
  }
}

export const auditService = new AuditService();
