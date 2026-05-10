class Order {
  static STATUS = {
    PENDING: 'PENDING',
    CANCELLED: 'CANCELLED',
    ALLOCATED: 'ALLOCATED',
    PICKED: 'PICKED',
    SHIPPED: 'SHIPPED',
    EXCEPTION: 'EXCEPTION'
  };

  static generateId(orderNumber) {
    return `ORD_${orderNumber.toUpperCase()}`;
  }

  constructor(data) {
    this.orderId = Order.generateId(data.orderNumber);
    this.orderNumber = data.orderNumber.toUpperCase();
    this.status = (data.status || Order.STATUS.PENDING).toUpperCase();
    this.carrierId = Carrier.generateId(data.carrierCode, data.carrierName || '');
    this.carrierCode = data.carrierCode.toUpperCase();
    this.carrierName = data.carrierName || null;
    this.customerName = data.customerName || null;
    this.orderDate = data.orderDate || new Date().toISOString().split('T')[0];
    this.shippingAddress = data.shippingAddress || null;
    this.items = (data.items || []).map(item => ({
      productId: Product.generateId(item.sku),
      sku: item.sku.toUpperCase(),
      qty: parseInt(item.qty, 10),
      unitPrice: parseFloat(item.unitPrice) || 0
    }));
    this.totalAmount = parseFloat(data.totalAmount) || 0;
    this.exceptionReasons = data.exceptionReasons || [];
    this.waveId = data.waveId || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  get isCancelled() {
    return this.status === Order.STATUS.CANCELLED;
  }

  get isException() {
    return this.status === Order.STATUS.EXCEPTION;
  }

  get isAllocated() {
    return this.status === Order.STATUS.ALLOCATED;
  }

  toJSON() {
    return {
      orderId: this.orderId,
      orderNumber: this.orderNumber,
      status: this.status,
      carrierId: this.carrierId,
      carrierCode: this.carrierCode,
      carrierName: this.carrierName,
      customerName: this.customerName,
      orderDate: this.orderDate,
      shippingAddress: this.shippingAddress,
      items: this.items,
      totalAmount: this.totalAmount,
      exceptionReasons: this.exceptionReasons,
      waveId: this.waveId,
      isCancelled: this.isCancelled,
      isException: this.isException,
      isAllocated: this.isAllocated,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

const Product = require('./Product');
const Carrier = require('./Carrier');
module.exports = Order;
