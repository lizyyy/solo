const { AuditLog } = require('../models');
const { v4: uuidv4 } = require('uuid');

class AuditService {
  static logQueue = [];
  static isProcessing = false;
  static useQueue = true;

  static async processQueue() {
    if (this.isProcessing || this.logQueue.length === 0) return;
    
    this.isProcessing = true;
    while (this.logQueue.length > 0) {
      const data = this.logQueue.shift();
      try {
        await AuditLog.create({
          id: uuidv4(),
          ...data
        });
      } catch (error) {
        console.error('审计日志记录失败:', error.message);
      }
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    this.isProcessing = false;
  }

  static async log(data) {
    if (!this.useQueue) {
      try {
        return await AuditLog.create({
          id: uuidv4(),
          ...data
        });
      } catch (error) {
        console.error('审计日志记录失败:', error.message);
        return null;
      }
    }
    
    this.logQueue.push(data);
    process.nextTick(() => this.processQueue());
    return Promise.resolve();
  }

  static setUseQueue(use) {
    this.useQueue = use;
  }

  static calculateDiff(before, after) {
    const diff = {};
    const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    
    for (const key of allKeys) {
      const beforeVal = before ? before[key] : undefined;
      const afterVal = after ? after[key] : undefined;
      
      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        diff[key] = {
          before: beforeVal,
          after: afterVal
        };
      }
    }
    
    return Object.keys(diff).length > 0 ? diff : null;
  }

  static async logChange(entityType, entityId, entityNo, action, operator, { before, after, batchId, batchNo, actionDetail, remark } = {}) {
    const diff = this.calculateDiff(before, after);
    
    return await this.log({
      batchId,
      batchNo,
      entityType,
      entityId,
      entityNo,
      action,
      actionDetail,
      beforeData: before ? JSON.stringify(before) : null,
      afterData: after ? JSON.stringify(after) : null,
      diffData: diff ? JSON.stringify(diff) : null,
      operator,
      remark
    });
  }

  static async getBatchAuditTrail(batchId) {
    return await AuditLog.findAll({
      where: { batchId },
      order: [['createdAt', 'ASC']]
    });
  }

  static async getEntityAuditTrail(entityType, entityId) {
    return await AuditLog.findAll({
      where: { entityType, entityId },
      order: [['createdAt', 'ASC']]
    });
  }

  static async getOperatorHistory(operator, limit = 100) {
    return await AuditLog.findAll({
      where: { operator },
      order: [['createdAt', 'DESC']],
      limit
    });
  }
}

module.exports = AuditService;
