const { v4: uuidv4 } = require('uuid');

class Compensation {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.orderId = data.orderId;
    this.orderNo = data.orderNo;
    this.shortageId = data.shortageId;
    this.ruleId = data.ruleId;
    this.userId = data.userId;
    this.userName = data.userName;
    this.phone = data.phone;
    this.productId = data.productId;
    this.productName = data.productName;
    this.shortageQuantity = parseInt(data.shortageQuantity, 10);
    this.compensationType = data.compensationType;
    this.refundAmount = data.refundAmount ? parseFloat(data.refundAmount) : null;
    this.couponId = data.couponId || null;
    this.couponValue = data.couponValue ? parseFloat(data.couponValue) : null;
    this.exchangeProductId = data.exchangeProductId || null;
    this.exchangeProductName = data.exchangeProductName || null;
    this.exchangeQuantity = data.exchangeQuantity ? parseInt(data.exchangeQuantity, 10) : null;
    this.status = data.status || 'pending';
    this.processedBy = data.processedBy || null;
    this.processedAt = data.processedAt ? new Date(data.processedAt) : null;
    this.remarks = data.remarks || '';
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  toJSON() {
    return {
      id: this.id,
      orderId: this.orderId,
      orderNo: this.orderNo,
      shortageId: this.shortageId,
      ruleId: this.ruleId,
      userId: this.userId,
      userName: this.userName,
      phone: this.phone,
      productId: this.productId,
      productName: this.productName,
      shortageQuantity: this.shortageQuantity,
      compensationType: this.compensationType,
      refundAmount: this.refundAmount,
      couponId: this.couponId,
      couponValue: this.couponValue,
      exchangeProductId: this.exchangeProductId,
      exchangeProductName: this.exchangeProductName,
      exchangeQuantity: this.exchangeQuantity,
      status: this.status,
      processedBy: this.processedBy,
      processedAt: this.processedAt ? this.processedAt.toISOString() : null,
      remarks: this.remarks,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(json) {
    return new Compensation(json);
  }
}

module.exports = Compensation;
