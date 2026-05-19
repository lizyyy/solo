const { v4: uuidv4 } = require('uuid');

class CompensationRule {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.ruleType = data.ruleType;
    this.productCategory = data.productCategory || '*';
    this.productId = data.productId || '*';
    this.minShortageQuantity = parseInt(data.minShortageQuantity || 1, 10);
    this.compensationType = data.compensationType;
    this.refundRate = data.refundRate ? parseFloat(data.refundRate) : null;
    this.couponValue = data.couponValue ? parseFloat(data.couponValue) : null;
    this.couponMinSpend = data.couponMinSpend ? parseFloat(data.couponMinSpend) : null;
    this.exchangeProductId = data.exchangeProductId || null;
    this.exchangeProductName = data.exchangeProductName || null;
    this.priority = parseInt(data.priority || 0, 10);
    this.enabled = data.enabled !== undefined ? Boolean(data.enabled) : true;
    this.description = data.description || '';
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  toJSON() {
    return {
      id: this.id,
      ruleType: this.ruleType,
      productCategory: this.productCategory,
      productId: this.productId,
      minShortageQuantity: this.minShortageQuantity,
      compensationType: this.compensationType,
      refundRate: this.refundRate,
      couponValue: this.couponValue,
      couponMinSpend: this.couponMinSpend,
      exchangeProductId: this.exchangeProductId,
      exchangeProductName: this.exchangeProductName,
      priority: this.priority,
      enabled: this.enabled,
      description: this.description,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(json) {
    return new CompensationRule(json);
  }

  matches(productId, productCategory, shortageQuantity) {
    if (!this.enabled) return false;
    if (this.productId !== '*' && this.productId !== productId) return false;
    if (this.productCategory !== '*' && productCategory !== '*' && this.productCategory !== productCategory) return false;
    if (shortageQuantity < this.minShortageQuantity) return false;
    return true;
  }
}

module.exports = CompensationRule;
