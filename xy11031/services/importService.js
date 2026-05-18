const { v4: uuidv4 } = require('uuid');
const { DispatchOrder, ImportResult, ISSUE_TYPES } = require('../models/dispatch');
const storage = require('./storage');
const validator = require('./validator');

class ImportService {
  constructor() {
    this.storage = storage;
    this.validator = validator;
  }

  async importOrders(ordersData, options = {}) {
    const batchId = options.batchId || uuidv4();
    const result = new ImportResult(batchId);
    const skipDuplicateCheck = options.skipDuplicateCheck || false;
    const skipTimeSlotCheck = options.skipTimeSlotCheck || false;
    const skipAuditCheck = options.skipAuditCheck || false;
    const autoResolveReview = options.autoResolveReview || false;

    result.totalCount = ordersData.length;

    for (let i = 0; i < ordersData.length; i++) {
      const rowData = ordersData[i];
      result.totalCount = i + 1;

      const validation = this.validator.validateDispatchData(rowData);
      
      if (!validation.valid) {
        const errorMessages = validation.errors.map(e => e.message).join('; ');
        const suggestions = validation.errors.map(e => `${e.field}: ${e.suggestion}`).join('; ');
        result.addFailure(
          rowData,
          `数据验证失败: ${errorMessages}`,
          suggestions
        );
        continue;
      }

      const order = new DispatchOrder({
        ...validation.value,
        importBatchId: batchId,
        originalRowData: rowData
      });

      let hasIssues = false;

      if (!skipDuplicateCheck) {
        const duplicateCheck = this.validator.checkDuplicateOrder(
          order,
          this.storage.getAllOrders()
        );
        if (duplicateCheck.isDuplicate) {
          order.addIssue({
            type: ISSUE_TYPES.DUPLICATE_ORDER,
            reason: duplicateCheck.reason,
            suggestion: duplicateCheck.suggestion
          });
          order.duplicateOrders = duplicateCheck.duplicateOrders;
          hasIssues = true;
        }
      }

      if (!skipTimeSlotCheck) {
        const timeSlotCheck = this.validator.checkTimeSlotOverlap(
          order,
          this.storage.getAllOrders()
        );
        if (timeSlotCheck.hasOverlap) {
          order.addIssue({
            type: ISSUE_TYPES.TIME_SLOT_OVERLAP,
            reason: timeSlotCheck.reason,
            suggestion: timeSlotCheck.suggestion
          });
          order.overlappingOrders = timeSlotCheck.overlappingOrders;
          hasIssues = true;
        }
      }

      if (!skipAuditCheck) {
        const auditCheck = this.validator.checkAuditConsistency(order);
        if (!auditCheck.consistent) {
          auditCheck.issues.forEach(issue => {
            order.addIssue({
              type: ISSUE_TYPES.AUDIT_INCONSISTENCY,
              reason: issue.reason,
              suggestion: issue.suggestion
            });
          });
          hasIssues = true;
        }
      }

      if (hasIssues) {
        if (autoResolveReview) {
          order.needsReview = false;
          order.status = validation.value.status || 'pending';
          order.issues.forEach(issue => {
            issue.resolved = true;
            issue.resolution = '导入时自动跳过检查';
            issue.resolvedAt = new Date().toISOString();
          });
          this.storage.addOrder(order);
          result.addSuccess(order);
        } else {
          this.storage.addOrder(order);
          result.addNeedsReview(order);
        }
      } else {
        this.storage.addOrder(order);
        result.addSuccess(order);
      }
    }

    result.complete();
    this.storage.addBatch(result.toJSON());

    return result.toJSON();
  }

  async processManualReview(orderId, action, remark, operator) {
    const order = this.storage.getOrderById(orderId);
    if (!order) {
      throw new Error('订单不存在');
    }

    if (!order.needsReview) {
      throw new Error('该订单不需要人工审核');
    }

    order.addManualRemark(remark, operator);

    switch (action) {
      case 'approve':
        order.issues.forEach(issue => {
          issue.resolved = true;
          issue.resolution = `人工审核通过: ${remark}`;
          issue.resolvedAt = new Date().toISOString();
        });
        order.needsReview = false;
        order.status = 'pending';
        break;

      case 'reject':
        order.status = 'cancelled';
        order.issues.forEach(issue => {
          issue.resolved = true;
          issue.resolution = `人工审核拒绝: ${remark}`;
          issue.resolvedAt = new Date().toISOString();
        });
        order.needsReview = false;
        break;

      case 'adjust_and_continue':
        order.needsReview = false;
        order.status = 'pending';
        break;

      default:
        throw new Error('无效的操作类型');
    }

    this.storage.updateOrder(orderId, order);
    return order.toJSON();
  }

  async getImportBatch(batchId) {
    return this.storage.getBatch(batchId);
  }

  async getAllBatches() {
    return this.storage.getAllBatches();
  }
}

module.exports = new ImportService();
