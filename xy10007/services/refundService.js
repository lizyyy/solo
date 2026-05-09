const { v4: uuidv4 } = require('uuid');
const { sequelize, Order, Refund } = require('../models');
const AuditService = require('./auditService');

class RefundService {
  static REFUND_STATUS = {
    PENDING_REVIEW: 'pending_review',
    REVIEWING: 'reviewing',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed'
  };

  static ORDER_STATUS = {
    PENDING: 'pending',
    PAID: 'paid',
    SHIPPED: 'shipped',
    COMPLETED: 'completed',
    REFUNDED: 'refunded',
    PARTIAL_REFUNDED: 'partial_refunded'
  };

  static async createRefund(options) {
    const {
      orderId,
      amount,
      reason,
      operatorId,
      operatorName,
      requestIdempotencyKey,
      ipAddress,
      userAgent
    } = options;

    const t = await sequelize.transaction();

    try {
      if (requestIdempotencyKey) {
        const existingRefund = await Refund.findOne({
          where: { requestIdempotencyKey },
          transaction: t
        });

        if (existingRefund) {
          await t.commit();
          return {
            success: true,
            refund: existingRefund,
            isDuplicate: true,
            message: 'Duplicate request detected, returning existing refund'
          };
        }
      }

      const order = await Order.findOne({
        where: { id: orderId },
        transaction: t,
        lock: true
      });

      if (!order) {
        await t.rollback();
        return { success: false, message: 'Order not found' };
      }

      const canRefundStatuses = [this.ORDER_STATUS.PAID, this.ORDER_STATUS.SHIPPED, this.ORDER_STATUS.COMPLETED, this.ORDER_STATUS.PARTIAL_REFUNDED];
      if (!canRefundStatuses.includes(order.status)) {
        await t.rollback();
        return { success: false, message: `Order status ${order.status} does not allow refund` };
      }

      const pendingRefunds = await Refund.sum('amount', {
        where: {
          orderId,
          status: [this.REFUND_STATUS.PENDING_REVIEW, this.REFUND_STATUS.REVIEWING, this.REFUND_STATUS.APPROVED, this.REFUND_STATUS.PROCESSING]
        },
        transaction: t
      });

      const availableAmount = parseFloat(order.amount) - parseFloat(order.refundedAmount) - (parseFloat(pendingRefunds) || 0);
      if (parseFloat(amount) > availableAmount) {
        await t.rollback();
        return { success: false, message: `Refund amount exceeds available amount: ${availableAmount.toFixed(2)}` };
      }

      const refundNo = `REF${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

      const refund = await Refund.create({
        refundNo,
        orderId,
        amount: parseFloat(amount).toFixed(2),
        reason,
        status: this.REFUND_STATUS.PENDING_REVIEW,
        operatorId,
        requestIdempotencyKey
      }, { transaction: t });

      await AuditService.log({
        entityType: 'Refund',
        entityId: refund.id,
        action: 'CREATE',
        operatorId,
        operatorName,
        oldValue: null,
        newValue: refund.toJSON(),
        ipAddress,
        userAgent
      }, t);

      await t.commit();

      return {
        success: true,
        refund,
        message: 'Refund created successfully'
      };
    } catch (error) {
      await t.rollback();
      console.error('Create refund error:', error);
      return { success: false, message: error.message };
    }
  }

  static async approveRefund(options) {
    const {
      refundId,
      operatorId,
      operatorName,
      comment,
      ipAddress,
      userAgent
    } = options;

    const t = await sequelize.transaction();

    try {
      const refund = await Refund.findOne({
        where: { id: refundId },
        transaction: t,
        lock: true
      });

      if (!refund) {
        await t.rollback();
        return { success: false, message: 'Refund not found' };
      }

      if (refund.status !== this.REFUND_STATUS.PENDING_REVIEW && refund.status !== this.REFUND_STATUS.REVIEWING) {
        await t.rollback();
        return { success: false, message: `Refund status ${refund.status} cannot be approved` };
      }

      const oldValue = refund.toJSON();

      refund.status = this.REFUND_STATUS.APPROVED;
      refund.operatorId = operatorId;
      refund.reviewComment = comment;

      await refund.save({ transaction: t });

      await AuditService.log({
        entityType: 'Refund',
        entityId: refund.id,
        action: 'APPROVE',
        operatorId,
        operatorName,
        oldValue,
        newValue: refund.toJSON(),
        ipAddress,
        userAgent
      }, t);

      await t.commit();

      return {
        success: true,
        refund,
        message: 'Refund approved successfully'
      };
    } catch (error) {
      await t.rollback();
      console.error('Approve refund error:', error);
      return { success: false, message: error.message };
    }
  }

  static async rejectRefund(options) {
    const {
      refundId,
      operatorId,
      operatorName,
      comment,
      ipAddress,
      userAgent
    } = options;

    const t = await sequelize.transaction();

    try {
      const refund = await Refund.findOne({
        where: { id: refundId },
        transaction: t,
        lock: true
      });

      if (!refund) {
        await t.rollback();
        return { success: false, message: 'Refund not found' };
      }

      if (refund.status !== this.REFUND_STATUS.PENDING_REVIEW && refund.status !== this.REFUND_STATUS.REVIEWING) {
        await t.rollback();
        return { success: false, message: `Refund status ${refund.status} cannot be rejected` };
      }

      const oldValue = refund.toJSON();

      refund.status = this.REFUND_STATUS.REJECTED;
      refund.operatorId = operatorId;
      refund.reviewComment = comment;

      await refund.save({ transaction: t });

      await AuditService.log({
        entityType: 'Refund',
        entityId: refund.id,
        action: 'REJECT',
        operatorId,
        operatorName,
        oldValue,
        newValue: refund.toJSON(),
        ipAddress,
        userAgent
      }, t);

      await t.commit();

      return {
        success: true,
        refund,
        message: 'Refund rejected successfully'
      };
    } catch (error) {
      await t.rollback();
      console.error('Reject refund error:', error);
      return { success: false, message: error.message };
    }
  }

  static async executeRefund(options) {
    const {
      refundId,
      operatorId,
      operatorName,
      executeIdempotencyKey,
      ipAddress,
      userAgent
    } = options;

    const t = await sequelize.transaction();

    try {
      if (executeIdempotencyKey) {
        const existingRefund = await Refund.findOne({
          where: { executeIdempotencyKey },
          transaction: t
        });

        if (existingRefund) {
          if (existingRefund.status === this.REFUND_STATUS.COMPLETED) {
            await t.commit();
            return {
              success: true,
              refund: existingRefund,
              isDuplicate: true,
              message: 'Duplicate execute request detected, refund already completed'
            };
          }
        }
      }

      const refund = await Refund.findOne({
        where: { id: refundId },
        transaction: t,
        lock: true
      });

      if (!refund) {
        await t.rollback();
        return { success: false, message: 'Refund not found' };
      }

      if (refund.status === this.REFUND_STATUS.COMPLETED) {
        await t.rollback();
        return { success: false, message: 'Refund already completed' };
      }

      if (refund.status !== this.REFUND_STATUS.APPROVED && refund.status !== this.REFUND_STATUS.FAILED) {
        await t.rollback();
        return { success: false, message: `Refund status ${refund.status} cannot be executed` };
      }

      const order = await Order.findOne({
        where: { id: refund.orderId },
        transaction: t,
        lock: true
      });

      if (!order) {
        await t.rollback();
        return { success: false, message: 'Order not found' };
      }

      const canRefundStatuses = [this.ORDER_STATUS.PAID, this.ORDER_STATUS.SHIPPED, this.ORDER_STATUS.COMPLETED, this.ORDER_STATUS.PARTIAL_REFUNDED];
      if (!canRefundStatuses.includes(order.status)) {
        await t.rollback();
        return { success: false, message: `Order status ${order.status} does not allow refund` };
      }

      const refundOldValue = refund.toJSON();
      const orderOldValue = order.toJSON();

      refund.status = this.REFUND_STATUS.PROCESSING;
      refund.executeIdempotencyKey = executeIdempotencyKey;
      refund.operatorId = operatorId;

      await refund.save({ transaction: t });

      const paymentSuccess = await this.simulatePaymentGateway(refund);

      if (!paymentSuccess) {
        await t.rollback();
        await Refund.update(
          { status: this.REFUND_STATUS.FAILED },
          { where: { id: refundId } }
        );
        return { success: false, message: 'Payment gateway failed' };
      }

      refund.status = this.REFUND_STATUS.COMPLETED;
      await refund.save({ transaction: t });

      const newRefundedAmount = parseFloat(order.refundedAmount) + parseFloat(refund.amount);
      order.refundedAmount = newRefundedAmount;

      if (newRefundedAmount >= parseFloat(order.amount)) {
        order.status = this.ORDER_STATUS.REFUNDED;
      } else {
        order.status = this.ORDER_STATUS.PARTIAL_REFUNDED;
      }

      await order.save({ transaction: t });

      await AuditService.log({
        entityType: 'Refund',
        entityId: refund.id,
        action: 'EXECUTE',
        operatorId,
        operatorName,
        oldValue: refundOldValue,
        newValue: refund.toJSON(),
        ipAddress,
        userAgent
      }, t);

      await AuditService.log({
        entityType: 'Order',
        entityId: order.id,
        action: 'REFUND',
        operatorId,
        operatorName,
        oldValue: orderOldValue,
        newValue: order.toJSON(),
        ipAddress,
        userAgent
      }, t);

      await t.commit();

      return {
        success: true,
        refund,
        message: 'Refund executed successfully'
      };
    } catch (error) {
      await t.rollback();
      console.error('Execute refund error:', error);
      await Refund.update(
        { status: this.REFUND_STATUS.FAILED },
        { where: { id: refundId } }
      );
      return { success: false, message: error.message };
    }
  }

  static async simulatePaymentGateway(refund) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return Math.random() > 0.1;
  }

  static async getRefundById(id) {
    return await Refund.findByPk(id, {
      include: [{ model: require('../models/Order'), as: 'order' }]
    });
  }

  static async getRefunds(options = {}) {
    const { limit = 20, offset = 0, orderId, status, startDate, endDate } = options;
    const where = {};

    if (orderId) where.orderId = orderId;
    if (status) where.status = status;
    if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };

    return await Refund.findAndCountAll({
      where,
      include: [{ model: require('../models/Order'), as: 'order' }],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
  }
}

module.exports = RefundService;