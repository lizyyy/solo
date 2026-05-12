const { v4: uuidv4 } = require('uuid');

class DataStore {
  constructor() {
    this.children = new Map();
    this.authorizers = new Map();
    this.tempAuthorizations = new Map();
    this.blacklist = new Map();
    this.checkIns = new Map();
    this.pickups = new Map();
    this.history = new Map();
    this.exceptions = new Map();
    this.pendingCallbacks = new Map();
  }

  generateId() {
    return uuidv4();
  }

  addHistory(entityType, entityId, action, details, operator = 'system') {
    const historyId = this.generateId();
    const record = {
      id: historyId,
      entityType,
      entityId,
      action,
      details,
      operator,
      timestamp: new Date().toISOString()
    };
    this.history.set(historyId, record);
    return record;
  }

  getHistoryByEntity(entityType, entityId) {
    return Array.from(this.history.values())
      .filter(h => h.entityType === entityType && h.entityId === entityId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  addException(entityType, entityId, exceptionType, message, details = {}) {
    const exceptionId = this.generateId();
    const exception = {
      id: exceptionId,
      entityType,
      entityId,
      exceptionType,
      message,
      details,
      status: 'open',
      timestamp: new Date().toISOString(),
      resolvedAt: null,
      resolvedBy: null,
      resolution: null,
      beforeState: null,
      afterState: null
    };
    this.exceptions.set(exceptionId, exception);
    return exception;
  }

  resolveException(exceptionId, resolution, operator, beforeState, afterState) {
    const exception = this.exceptions.get(exceptionId);
    if (!exception) throw new Error('异常记录不存在');
    
    exception.status = 'resolved';
    exception.resolvedAt = new Date().toISOString();
    exception.resolvedBy = operator;
    exception.resolution = resolution;
    exception.beforeState = beforeState;
    exception.afterState = afterState;
    
    this.addHistory('exception', exceptionId, 'resolved', { resolution, operator, beforeState, afterState }, operator);
    return exception;
  }
}

module.exports = new DataStore();
