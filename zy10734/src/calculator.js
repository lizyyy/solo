const { RedispatchRecord, CompensationResult } = require('./models');

const SYSTEM_REDISPATCH_COMPENSATION = 8;
const RIDER_REJECTION_COMPENSATION_BASE = 5;

class CompensationCalculator {
  constructor(redispatchRecords, riderSettlements, rejectionReasons) {
    this.redispatchRecords = redispatchRecords;
    this.riderSettlements = new Map(riderSettlements.map(s => [s.riderId, s]));
    this.rejectionReasons = new Map(rejectionReasons.map(r => [r.reasonCode, r]));
    this.processedOrders = new Set();
  }

  calculate() {
    const results = [];
    const errors = [];
    const orderCounts = new Map();

    this.redispatchRecords.forEach(record => {
      const count = orderCounts.get(record.orderId) || 0;
      orderCounts.set(record.orderId, count + 1);
    });

    this.redispatchRecords.forEach((record, index) => {
      try {
        const result = this.calculateSingle(record, index, orderCounts);
        results.push(result);
      } catch (error) {
        errors.push({
          recordIndex: index,
          orderId: record.orderId || `未知订单_${index}`,
          error: error.message
        });
        results.push(new CompensationResult({
          orderId: record.orderId || `未知订单_${index}`,
          isError: true,
          errorMessage: error.message,
          compensationStatus: '核算失败',
          compensationRemark: `改派记录第${index + 1}行: ${error.message}`
        }));
      }
    });

    return {
      results,
      errors,
      summary: this.generateSummary(results)
    };
  }

  calculateSingle(record, index, orderCounts) {
    const errors = record.validate();
    if (errors.length > 0) {
      throw new Error(`数据验证失败: ${errors.join('; ')}`);
    }

    const isDuplicate = orderCounts.get(record.orderId) > 1;
    const isPreviouslyCompensated = this.isPreviouslyCompensated(record);

    let calculatedCompensation = 0;
    let compensationRemark = '';

    if (record.isSystemRedispatch) {
      calculatedCompensation = SYSTEM_REDISPATCH_COMPENSATION;
      compensationRemark = `系统改派补偿：${SYSTEM_REDISPATCH_COMPENSATION}元`;
    } else if (record.isRiderRejection) {
      const reason = this.findRejectionReason(record.redispatchReason);
      if (reason && reason.isCompensable) {
        calculatedCompensation = reason.calculateCompensation(RIDER_REJECTION_COMPENSATION_BASE);
        compensationRemark = `骑手拒单补偿：原因[${record.redispatchReason}]，金额${calculatedCompensation.toFixed(2)}元`;
      } else {
        compensationRemark = `拒单原因[${record.redispatchReason}]不可补偿`;
      }
    } else {
      calculatedCompensation = record.compensationAmount || 5;
      compensationRemark = `常规改派补偿：${calculatedCompensation.toFixed(2)}元`;
    }

    let finalCompensation = calculatedCompensation;
    let compensationStatus = '待发放';

    if (isDuplicate) {
      if (this.processedOrders.has(record.orderId)) {
        finalCompensation = 0;
        compensationStatus = '重复跳过';
        compensationRemark += ' | 重复订单，已跳过重复补偿';
      } else {
        compensationRemark += ' | 注意：存在多条改派记录，已首次核算';
      }
    }

    if (isPreviouslyCompensated) {
      finalCompensation = 0;
      compensationStatus = '已补偿';
      compensationRemark += ' | 该订单骑手已结算过，不再重复补偿';
    }

    this.processedOrders.add(record.orderId);

    return new CompensationResult({
      orderId: record.orderId,
      originalRiderId: record.originalRiderId,
      originalRiderName: record.originalRiderName,
      newRiderId: record.newRiderId,
      newRiderName: record.newRiderName,
      redispatchTime: record.redispatchTime,
      redispatchType: record.redispatchType,
      redispatchReason: record.redispatchReason,
      calculatedCompensation: calculatedCompensation,
      previousCompensation: isPreviouslyCompensated ? calculatedCompensation : 0,
      finalCompensation: finalCompensation,
      compensationStatus: compensationStatus,
      compensationRemark: compensationRemark,
      isDuplicate: isDuplicate,
      isError: false
    });
  }

  isPreviouslyCompensated(record) {
    const settlement = this.riderSettlements.get(record.originalRiderId);
    if (settlement) {
      return settlement.hasBeenCompensated(record.orderId);
    }
    return false;
  }

  findRejectionReason(reasonName) {
    for (const [, reason] of this.rejectionReasons) {
      if (reasonName && reasonName.includes(reason.reasonName)) {
        return reason;
      }
    }
    return null;
  }

  generateSummary(results) {
    const totalRecords = results.length;
    const errorRecords = results.filter(r => r.isError).length;
    const duplicateRecords = results.filter(r => r.isDuplicate).length;
    const compensatedRecords = results.filter(r => r.finalCompensation > 0).length;
    const skippedRecords = results.filter(r => r.finalCompensation === 0 && !r.isError).length;
    const totalCompensation = results.reduce((sum, r) => sum + r.finalCompensation, 0);

    return {
      totalRecords,
      errorRecords,
      duplicateRecords,
      compensatedRecords,
      skippedRecords,
      totalCompensation
    };
  }
}

module.exports = CompensationCalculator;
