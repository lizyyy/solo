const OperationLog = require('../models/OperationLog');

class OperationLogService {
  calculateDiff(beforeData, afterData) {
    const diff = {};
    const allKeys = new Set([
      ...Object.keys(beforeData || {}),
      ...Object.keys(afterData || {})
    ]);

    for (const key of allKeys) {
      const beforeValue = beforeData?.[key];
      const afterValue = afterData?.[key];
      
      if (beforeValue !== afterValue) {
        diff[key] = {
          before: beforeValue,
          after: afterValue
        };
      }
    }

    return diff;
  }

  recordOperation(applicationId, operationType, module, operator, beforeData, afterData, reason) {
    const diff = this.calculateDiff(beforeData, afterData);
    const hasChanges = Object.keys(diff).length > 0;

    return OperationLog.create({
      application_id: applicationId,
      operation_type: operationType,
      module,
      operator,
      before_data: beforeData ? JSON.stringify(beforeData) : null,
      after_data: afterData ? JSON.stringify(afterData) : null,
      diff_summary: hasChanges ? JSON.stringify(diff) : null,
      reason
    });
  }

  getLogsByApplication(applicationId) {
    const logs = OperationLog.findByApplicationId(applicationId);
    return logs.map(log => ({
      ...log,
      before_data: log.before_data ? JSON.parse(log.before_data) : null,
      after_data: log.after_data ? JSON.parse(log.after_data) : null,
      diff_summary: log.diff_summary ? JSON.parse(log.diff_summary) : null
    }));
  }

  recordManualCorrection(applicationId, module, operator, beforeData, afterData, reason) {
    return this.recordOperation(
      applicationId,
      'MANUAL_CORRECTION',
      module,
      operator,
      beforeData,
      afterData,
      reason
    );
  }
}

module.exports = new OperationLogService();
