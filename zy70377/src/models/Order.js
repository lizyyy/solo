const { generateId, getCurrentTime } = require('../utils/idGenerator');

const orders = new Map();

class Order {
  constructor(data) {
    this.id = data.id || generateId('order');
    this.customerName = data.customerName;
    this.destinationAddress = data.destinationAddress;
    this.destinationLat = data.destinationLat;
    this.destinationLon = data.destinationLon;
    this.originAddress = data.originAddress;
    this.originLat = data.originLat;
    this.originLon = data.originLon;
    this.createdAt = data.createdAt || getCurrentTime();
    this.riderId = data.riderId || null;
    this.status = data.status || 'pending';
    this.priority = data.priority || 'normal';
    this.baseEtaMinutes = data.baseEtaMinutes || 30;
    this.currentEta = null;
    this.initialEta = null;
    this.signedAt = null;
    this.isClosed = false;
  }

  static create(data) {
    const order = new Order(data);
    orders.set(order.id, order);
    return order;
  }

  static findById(id) {
    return orders.get(id) || null;
  }

  static update(id, updates) {
    const order = orders.get(id);
    if (!order) return null;
    Object.assign(order, updates);
    return order;
  }

  static getAll() {
    return Array.from(orders.values());
  }
}

module.exports = Order;
