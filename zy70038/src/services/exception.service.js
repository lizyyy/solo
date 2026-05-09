const storage = require('../storage/file-storage');
const { ExceptionRecord, ExceptionSeverity } = require('../models/exception');

class ExceptionService {
  getUnresolvedExceptions(severity = null) {
    const exceptions = storage.getExceptions();
    let unresolved = exceptions.filter(e => !e.resolved);
    
    if (severity) {
      unresolved = unresolved.filter(e => e.severity === severity);
    }
    
    return unresolved.map(e => ExceptionRecord.fromJSON(e));
  }
  
  getAllExceptions(orderId = null) {
    const exceptions = storage.getExceptions();
    let result = exceptions;
    
    if (orderId) {
      result = result.filter(e => e.orderId === orderId);
    }
    
    return result.map(e => ExceptionRecord.fromJSON(e));
  }
  
  resolveException(exceptionId, resolvedBy, notes = '') {
    const exceptions = storage.getExceptions();
    const index = exceptions.findIndex(e => e.exceptionId === exceptionId);
    
    if (index === -1) {
      return { success: false, reason: '异常记录不存在' };
    }
    
    const exception = ExceptionRecord.fromJSON(exceptions[index]);
    const resolveResult = exception.resolve(resolvedBy, notes);
    
    if (!resolveResult.success) {
      return resolveResult;
    }
    
    exceptions[index] = exception.toJSON();
    storage.saveExceptions(exceptions);
    
    return { success: true, exception: exception.toJSON() };
  }
  
  getPendingList(storeId = null) {
    const exceptions = this.getUnresolvedExceptions();
    let pending = exceptions;
    
    if (storeId) {
      const orders = storage.getOrders();
      const storeOrderIds = new Set(
        orders.filter(o => o.storeId === storeId).map(o => o.orderId)
      );
      pending = pending.filter(e => storeOrderIds.has(e.orderId) || !e.orderId);
    }
    
    return pending.sort((a, b) => {
      const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
      const sevA = severityOrder[a.severity] || 3;
      const sevB = severityOrder[b.severity] || 3;
      if (sevA !== sevB) return sevA - sevB;
      return b.timestamp - a.timestamp;
    });
  }
  
  getStatistics() {
    const exceptions = storage.getExceptions();
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    const recent = exceptions.filter(e => e.timestamp > oneDayAgo);
    
    return {
      total: exceptions.length,
      unresolved: exceptions.filter(e => !e.resolved).length,
      resolved: exceptions.filter(e => e.resolved).length,
      last24h: {
        total: recent.length,
        unresolved: recent.filter(e => !e.resolved).length
      },
      bySeverity: {
        critical: exceptions.filter(e => e.severity === ExceptionSeverity.CRITICAL).length,
        error: exceptions.filter(e => e.severity === ExceptionSeverity.ERROR).length,
        warning: exceptions.filter(e => e.severity === ExceptionSeverity.WARNING).length,
        info: exceptions.filter(e => e.severity === ExceptionSeverity.INFO).length
      }
    };
  }
}

module.exports = new ExceptionService();
