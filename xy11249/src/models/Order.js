const { v4: uuidv4 } = require('uuid');

class Order {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.orderNo = data.orderNo;
    this.userId = data.userId;
    this.userName = data.userName;
    this.phone = data.phone;
    this.groupLeaderId = data.groupLeaderId;
    this.groupLeaderName = data.groupLeaderName;
    this.productId = data.productId;
    this.productName = data.productName;
    this.quantity = parseInt(data.quantity, 10);
    this.unitPrice = parseFloat(data.unitPrice);
    this.totalAmount = parseFloat(data.totalAmount);
    this.status = data.status || 'pending';
    this.paymentTime = data.paymentTime ? new Date(data.paymentTime) : null;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  toJSON() {
    return {
      id: this.id,
      orderNo: this.orderNo,
      userId: this.userId,
      userName: this.userName,
      phone: this.phone,
      groupLeaderId: this.groupLeaderId,
      groupLeaderName: this.groupLeaderName,
      productId: this.productId,
      productName: this.productName,
      quantity: this.quantity,
      unitPrice: this.unitPrice,
      totalAmount: this.totalAmount,
      status: this.status,
      paymentTime: this.paymentTime ? this.paymentTime.toISOString() : null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(json) {
    return new Order(json);
  }
}

module.exports = Order;
