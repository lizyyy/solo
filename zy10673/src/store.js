const moment = require('moment');
const { PRICE_STATUS, EXPIRATION_REASONS } = require('./types');

class PriceStore {
  constructor() {
    this.prices = [];
    this.priceHistory = [];
    this.nextId = 1;
    this.nextHistoryId = 1;
  }

  createPrice(data) {
    const price = {
      id: `P${String(this.nextId++).padStart(6, '0')}`,
      customerId: data.customerId,
      customerName: data.customerName,
      customerLevel: data.customerLevel,
      skuCode: data.skuCode,
      skuName: data.skuName,
      skuCategory: data.skuCategory,
      exclusivePrice: Number(data.exclusivePrice),
      originalPrice: Number(data.originalPrice),
      currency: data.currency || 'CNY',
      effectiveDate: data.effectiveDate,
      expiryDate: data.expiryDate,
      status: data.status || PRICE_STATUS.ACTIVE,
      expirationReason: data.expirationReason || null,
      expirationReasonLabel: data.expirationReasonLabel || null,
      operator: data.operator,
      remark: data.remark || '',
      createdAt: moment().format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: moment().format('YYYY-MM-DD HH:mm:ss')
    };
    this.prices.push(price);
    this.addHistory(price.id, 'CREATE', price, data.operator);
    return price;
  }

  getPrice(id) {
    return this.prices.find(p => p.id === id);
  }

  listPrices(filters = {}) {
    let results = [...this.prices];
    if (filters.customerId) {
      results = results.filter(p => p.customerId === filters.customerId);
    }
    if (filters.skuCode) {
      results = results.filter(p => p.skuCode === filters.skuCode);
    }
    if (filters.status) {
      results = results.filter(p => p.status === filters.status);
    }
    return results;
  }

  updateStatus(id, newStatus, reason, operator, remark = '') {
    const price = this.getPrice(id);
    if (!price) {
      throw new Error(`价格记录 ${id} 不存在`);
    }
    const oldStatus = price.status;
    price.status = newStatus;
    price.expirationReason = reason;
    price.remark = remark;
    price.updatedAt = moment().format('YYYY-MM-DD HH:mm:ss');
    this.addHistory(id, 'STATUS_CHANGE', { oldStatus, newStatus, reason }, operator);
    return price;
  }

  addHistory(priceId, actionType, details, operator) {
    this.priceHistory.push({
      id: `H${String(this.nextHistoryId++).padStart(6, '0')}`,
      priceId,
      actionType,
      details,
      operator,
      createdAt: moment().format('YYYY-MM-DD HH:mm:ss')
    });
  }

  getHistory(priceId) {
    return this.priceHistory.filter(h => h.priceId === priceId);
  }

  findConflict(customerId, skuCode, excludeId = null) {
    return this.prices.find(p => 
      p.customerId === customerId && 
      p.skuCode === skuCode && 
      p.id !== excludeId &&
      p.status === PRICE_STATUS.ACTIVE
    );
  }

  batchImport(records, operator) {
    const results = {
      success: [],
      failed: [],
      conflicts: []
    };

    records.forEach((record, index) => {
      try {
        const errors = this.validateRecord(record, index);
        if (errors.length > 0) {
          results.failed.push({
            row: index + 1,
            record,
            errors
          });
          return;
        }

        const conflict = this.findConflict(record.customerId, record.skuCode);
        if (conflict) {
          results.conflicts.push({
            row: index + 1,
            record,
            existingPrice: conflict
          });
          return;
        }

        const price = this.createPrice({ ...record, operator });
        results.success.push({
          row: index + 1,
          priceId: price.id
        });
      } catch (error) {
        results.failed.push({
          row: index + 1,
          record,
          errors: [error.message]
        });
      }
    });

    return results;
  }

  validateRecord(record, index) {
    const errors = [];
    if (!record.customerId) errors.push(`第${index + 1}行: 客户ID不能为空`);
    if (!record.skuCode) errors.push(`第${index + 1}行: SKU编码不能为空`);
    if (!record.exclusivePrice || isNaN(Number(record.exclusivePrice))) {
      errors.push(`第${index + 1}行: 专属价必须是有效数字`);
    }
    if (!record.effectiveDate) errors.push(`第${index + 1}行: 生效日期不能为空`);
    if (!record.expiryDate) errors.push(`第${index + 1}行: 失效日期不能为空`);
    if (record.effectiveDate && record.expiryDate && 
        moment(record.effectiveDate).isAfter(record.expiryDate)) {
      errors.push(`第${index + 1}行: 生效日期不能晚于失效日期`);
    }
    return errors;
  }

  exportPrices(filters = {}) {
    return this.listPrices(filters).map(p => ({
      价格ID: p.id,
      客户ID: p.customerId,
      客户名称: p.customerName,
      客户等级: p.customerLevel,
      SKU编码: p.skuCode,
      SKU名称: p.skuName,
      专属价: p.exclusivePrice,
      原价: p.originalPrice,
      生效日期: p.effectiveDate,
      失效日期: p.expiryDate,
      状态: p.status,
      失效原因: p.expirationReasonLabel || '',
      操作人: p.operator,
      创建时间: p.createdAt,
      最后更新: p.updatedAt
    }));
  }
}

module.exports = new PriceStore();
