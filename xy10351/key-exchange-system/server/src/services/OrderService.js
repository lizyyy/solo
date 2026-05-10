const { Order, Key, AuditLog, ExchangeRecord } = require('../models');

class OrderService {
  async getAllOrders() {
    return await Order.findAll({
      include: [{ model: Key, attributes: ['keyCode', 'cabinetNumber'] }],
      order: [['scheduledDate', 'DESC']],
    });
  }

  async getOrderById(id) {
    return await Order.findByPk(id, {
      include: [
        { model: Key, attributes: ['keyCode', 'cabinetNumber', 'customerName', 'address'] },
        { model: ExchangeRecord }
      ],
    });
  }

  async createOrder(orderData, operator) {
    const order = await Order.create(orderData);
    
    await AuditLog.create({
      action: 'CREATE',
      entityType: 'Order',
      entityId: order.id,
      operator: operator.name,
      oldValue: null,
      newValue: JSON.stringify(orderData),
    });
    
    return order;
  }

  async updateOrder(id, orderData, operator) {
    const order = await Order.findByPk(id);
    if (!order) throw new Error('订单不存在');
    
    const oldValue = JSON.stringify(order.toJSON());
    await order.update(orderData);
    const newValue = JSON.stringify(order.toJSON());
    
    await AuditLog.create({
      action: 'UPDATE',
      entityType: 'Order',
      entityId: id,
      operator: operator.name,
      oldValue,
      newValue,
    });
    
    return order;
  }

  async getAvailableOrders() {
    return await Order.findAll({
      where: { 
        status: ['pending', 'in_progress'],
      },
      include: [{ model: Key, where: { status: 'available' }, required: false }],
    });
  }

  async getOrdersByCleaner(cleanerName) {
    return await Order.findAll({
      where: { cleanerName },
      include: [{ model: Key }],
      order: [['scheduledDate', 'DESC']],
    });
  }
}

module.exports = new OrderService();
