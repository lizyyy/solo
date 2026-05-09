const { sequelize, Order } = require('../models');
const AuditService = require('./auditService');

class OrderService {
  static ORDER_STATUS = {
    PENDING: 'pending',
    PAID: 'paid',
    SHIPPED: 'shipped',
    COMPLETED: 'completed',
    REFUNDED: 'refunded',
    PARTIAL_REFUNDED: 'partial_refunded'
  };

  static async createOrder(options) {
    const { orderNo, userId, amount, operatorId, operatorName, ipAddress, userAgent } = options;

    const t = await sequelize.transaction();

    try {
      const existingOrder = await Order.findOne({
        where: { orderNo },
        transaction: t
      });

      if (existingOrder) {
        await t.commit();
        return { success: false, message: 'Order with this number already exists' };
      }

      const order = await Order.create({
        orderNo,
        userId,
        amount: parseFloat(amount).toFixed(2),
        status: this.ORDER_STATUS.PENDING,
        refundedAmount: 0
      }, { transaction: t });

      await AuditService.log({
        entityType: 'Order',
        entityId: order.id,
        action: 'CREATE',
        operatorId,
        operatorName,
        oldValue: null,
        newValue: order.toJSON(),
        ipAddress,
        userAgent
      }, t);

      await t.commit();

      return {
        success: true,
        order,
        message: 'Order created successfully'
      };
    } catch (error) {
      await t.rollback();
      console.error('Create order error:', error);
      return { success: false, message: error.message };
    }
  }

  static async updateOrderStatus(options) {
    const { orderId, status, operatorId, operatorName, ipAddress, userAgent } = options;

    const t = await sequelize.transaction();

    try {
      const order = await Order.findOne({
        where: { id: orderId },
        transaction: t,
        lock: true
      });

      if (!order) {
        await t.rollback();
        return { success: false, message: 'Order not found' };
      }

      const oldValue = order.toJSON();

      order.status = status;
      await order.save({ transaction: t });

      await AuditService.log({
        entityType: 'Order',
        entityId: order.id,
        action: 'UPDATE_STATUS',
        operatorId,
        operatorName,
        oldValue,
        newValue: order.toJSON(),
        ipAddress,
        userAgent
      }, t);

      await t.commit();

      return {
        success: true,
        order,
        message: 'Order status updated successfully'
      };
    } catch (error) {
      await t.rollback();
      console.error('Update order status error:', error);
      return { success: false, message: error.message };
    }
  }

  static async getOrderById(id) {
    return await Order.findByPk(id, {
      include: [{ model: require('../models/Refund'), as: 'refunds' }]
    });
  }

  static async getOrderByOrderNo(orderNo) {
    return await Order.findOne({
      where: { orderNo },
      include: [{ model: require('../models/Refund'), as: 'refunds' }]
    });
  }

  static async getOrders(options = {}) {
    const { limit = 20, offset = 0, userId, status, startDate, endDate } = options;
    const where = {};

    if (userId) where.userId = userId;
    if (status) where.status = status;
    if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };

    return await Order.findAndCountAll({
      where,
      include: [{ model: require('../models/Refund'), as: 'refunds' }],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
  }
}

module.exports = OrderService;