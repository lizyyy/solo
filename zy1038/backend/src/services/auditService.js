import { v4 as uuidv4 } from 'uuid';
import { storageService } from './storage.js';

export class AuditService {
  constructor() {}

  async log(action, entityType, entityId, oldValue, newValue, description) {
    const logs = await storageService.getAuditLogs();
    
    const logEntry = {
      id: uuidv4(),
      action,
      entityType,
      entityId,
      oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
      newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
      description,
      timestamp: new Date().toISOString()
    };

    logs.unshift(logEntry);
    await storageService.saveAuditLogs(logs);
    
    return logEntry;
  }

  async logCreate(entityType, entity, description) {
    return this.log('CREATE', entityType, entity.id, null, entity, description);
  }

  async logUpdate(entityType, entityId, oldValue, newValue, description) {
    return this.log('UPDATE', entityType, entityId, oldValue, newValue, description);
  }

  async logDelete(entityType, entityId, oldValue, description) {
    return this.log('DELETE', entityType, entityId, oldValue, null, description);
  }

  async getLogs(options = {}) {
    const { entityType, action, limit = 100, offset = 0 } = options;
    let logs = await storageService.getAuditLogs();

    if (entityType) {
      logs = logs.filter(log => log.entityType === entityType);
    }

    if (action) {
      logs = logs.filter(log => log.action === action);
    }

    return {
      total: logs.length,
      logs: logs.slice(offset, offset + limit)
    };
  }

  async getLogsForEntity(entityType, entityId) {
    const logs = await storageService.getAuditLogs();
    return logs.filter(log => 
      log.entityType === entityType && log.entityId === entityId
    );
  }

  async clearLogs() {
    await storageService.saveAuditLogs([]);
  }
}

export const auditService = new AuditService();
