class ExceptionRecord {
  constructor(options) {
    this.exceptionId = options.exceptionId;
    this.orderId = options.orderId;
    this.exceptionType = options.exceptionType;
    this.severity = options.severity || 'warning';
    this.timestamp = options.timestamp || Date.now();
    this.message = options.message;
    this.details = options.details || {};
    this.resolved = options.resolved || false;
    this.resolvedAt = options.resolvedAt || null;
    this.resolvedBy = options.resolvedBy || null;
    this.resolutionNotes = options.resolutionNotes || null;
  }
  
  resolve(resolvedBy, notes = '') {
    if (this.resolved) {
      return { success: false, reason: '该异常已被处理' };
    }
    
    this.resolved = true;
    this.resolvedAt = Date.now();
    this.resolvedBy = resolvedBy;
    this.resolutionNotes = notes;
    
    return { success: true };
  }
  
  toJSON() {
    return {
      exceptionId: this.exceptionId,
      orderId: this.orderId,
      exceptionType: this.exceptionType,
      severity: this.severity,
      timestamp: this.timestamp,
      message: this.message,
      details: this.details,
      resolved: this.resolved,
      resolvedAt: this.resolvedAt,
      resolvedBy: this.resolvedBy,
      resolutionNotes: this.resolutionNotes
    };
  }
  
  static fromJSON(data) {
    return new ExceptionRecord(data);
  }
}

const ExceptionType = {
  STOCK_RESERVE_FAILED: 'stock_reserve_failed',
  STOCK_RESTORE_FAILED: 'stock_restore_failed',
  PICKUP_CODE_DUPLICATE: 'pickup_code_duplicate',
  ORDER_STATE_CONFLICT: 'order_state_conflict',
  EXTENSION_EXCEEDED_LIMIT: 'extension_exceeded_limit',
  TIMEOUT_RELEASE_FAILED: 'timeout_release_failed',
  PICKUP_VALIDATION_FAILED: 'pickup_validation_failed',
  UNEXPECTED_ERROR: 'unexpected_error'
};

const ExceptionSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

module.exports = { ExceptionRecord, ExceptionType, ExceptionSeverity };
