const { v4: uuidv4 } = require('uuid');

const RESULT_STATUS = {
  NORMAL: 'normal',
  PENDING: 'pending',
  FAILED: 'failed'
};

class CalculationResult {
  constructor() {
    this.id = uuidv4();
    this.batchId = null;
    this.calculatedAt = new Date().toISOString();
    this.normalItems = [];
    this.pendingItems = [];
    this.failedItems = [];
    this.summary = {
      total: 0,
      normal: 0,
      pending: 0,
      failed: 0,
      totalSubsidy: 0,
      totalBoxOffice: 0,
      totalRefundDeduction: 0
    };
  }

  setBatchId(batchId) {
    this.batchId = batchId;
  }

  addNormalItem(item, detail) {
    this.normalItems.push({
      traceId: uuidv4(),
      originalData: item.toJSON ? item.toJSON() : item,
      calculationDetail: detail,
      status: RESULT_STATUS.NORMAL
    });
    this.summary.normal++;
    this.summary.total++;
    if (detail.subsidyAmount) {
      this.summary.totalSubsidy += detail.subsidyAmount;
    }
    if (detail.boxOffice) {
      this.summary.totalBoxOffice += detail.boxOffice;
    }
  }

  addPendingItem(item, detail, reason, suggestion) {
    this.pendingItems.push({
      traceId: uuidv4(),
      originalData: item.toJSON ? item.toJSON() : item,
      calculationDetail: detail,
      reason: reason,
      suggestion: suggestion,
      status: RESULT_STATUS.PENDING
    });
    this.summary.pending++;
    this.summary.total++;
  }

  addFailedItem(item, detail, errors, suggestion) {
    this.failedItems.push({
      traceId: uuidv4(),
      originalData: item.toJSON ? item.toJSON() : item,
      calculationDetail: detail,
      errors: Array.isArray(errors) ? errors : [errors],
      suggestion: suggestion,
      status: RESULT_STATUS.FAILED
    });
    this.summary.failed++;
    this.summary.total++;
  }

  addRefundDeduction(amount) {
    this.summary.totalRefundDeduction += amount;
  }

  getTraceItem(traceId) {
    const allItems = [...this.normalItems, ...this.pendingItems, ...this.failedItems];
    return allItems.find(item => item.traceId === traceId) || null;
  }

  finalize() {
    this.summary.totalSubsidy = Math.round(this.summary.totalSubsidy * 100) / 100;
    this.summary.totalBoxOffice = Math.round(this.summary.totalBoxOffice * 100) / 100;
    this.summary.totalRefundDeduction = Math.round(this.summary.totalRefundDeduction * 100) / 100;
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      batchId: this.batchId,
      calculatedAt: this.calculatedAt,
      summary: this.summary,
      normalItems: this.normalItems,
      pendingItems: this.pendingItems,
      failedItems: this.failedItems
    };
  }

  toSummaryJSON() {
    return {
      id: this.id,
      batchId: this.batchId,
      calculatedAt: this.calculatedAt,
      summary: this.summary,
      itemCounts: {
        normal: this.normalItems.length,
        pending: this.pendingItems.length,
        failed: this.failedItems.length
      }
    };
  }
}

module.exports = { CalculationResult, RESULT_STATUS };
