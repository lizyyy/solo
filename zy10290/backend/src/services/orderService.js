const { all, get, run } = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const InventoryService = require('./inventoryService');
const { ORDER_STATUS, PAYMENT_STATUS, SHIPPING_STATUS, REFUND_STATUS, COMPENSATION_STATUS, INVENTORY_CHANGE_TYPE } = require('../utils/constants');

class OrderService {
  static generateOrderNo() {
    return 'FS' + dayjs().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 10000);
  }

  static generateIdempotentKey(prefix, uniqueId) {
    return `${prefix}_${uniqueId}`;
  }

  static async createOrder(activityId, productId, userId, userName, userPhone, quantity = 1) {
    const product = await get('SELECT * FROM flash_sale_products WHERE id = ?', [productId]);
    if (!product) {
      return { success: false, message: '商品不存在' };
    }

    const lockKey = this.generateIdempotentKey('lock', `${productId}_${userId}_${Date.now()}`);
    const lockResult = await InventoryService.checkAndLockStock(productId, quantity, lockKey, 'system', '系统', '下单锁库存');
    if (!lockResult.success) {
      return { success: false, message: lockResult.message };
    }

    const orderNo = this.generateOrderNo();
    const orderId = uuidv4();
    const unitPrice = product.flash_price;
    const totalAmount = unitPrice * quantity;

    await run(`
      INSERT INTO flash_sale_orders (id, activity_id, product_id, order_no, user_id, user_name, user_phone, quantity, unit_price, total_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [orderId, activityId, productId, orderNo, userId, userName, userPhone, quantity, unitPrice, totalAmount]);

    return { success: true, orderId, orderNo };
  }

  static async processPaymentCallback(orderId, transactionId, success = true) {
    const order = await get('SELECT * FROM flash_sale_orders WHERE id = ?', [orderId]);
    if (!order) {
      return { success: false, message: '订单不存在' };
    }

    if (order.status === ORDER_STATUS.CANCELLED) {
      return { success: false, message: '订单已取消，拒绝支付回调' };
    }

    const idempotentKey = this.generateIdempotentKey('payment', transactionId);
    const existingLog = await get('SELECT id FROM inventory_change_logs WHERE idempotent_key = ?', [idempotentKey]);
    if (existingLog) {
      return { success: true, duplicate: true, message: '支付回调重复处理' };
    }

    if (success) {
      if (order.payment_status === PAYMENT_STATUS.PAID) {
        return { success: true, duplicate: true, message: '订单已支付' };
      }

      const confirmResult = await InventoryService.confirmStock(order.product_id, order.quantity, orderId, idempotentKey, 'system', '系统', '支付成功扣库存');
      if (!confirmResult.success) {
        return { success: false, message: confirmResult.message };
      }

      await run(`
        UPDATE flash_sale_orders 
        SET payment_status = ?, status = ?, payment_time = CURRENT_TIMESTAMP, payment_transaction_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [PAYMENT_STATUS.PAID, ORDER_STATUS.CONFIRMED, transactionId, orderId]);

      return { success: true, message: '支付成功' };
    } else {
      const releaseKey = this.generateIdempotentKey('release_payfail', orderId);
      const releaseResult = await InventoryService.releaseStock(order.product_id, order.quantity, orderId, releaseKey, 'system', '系统', '支付失败释放库存');
      if (!releaseResult.success && !releaseResult.duplicate) {
        return { success: false, message: releaseResult.message };
      }
      
      await run(`
        UPDATE flash_sale_orders 
        SET payment_status = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [PAYMENT_STATUS.FAILED, ORDER_STATUS.CANCELLED, orderId]);

      return { success: true, message: '支付失败，库存已释放' };
    }
  }

  static async processTimeoutOrder(orderId) {
    const order = await get('SELECT * FROM flash_sale_orders WHERE id = ?', [orderId]);
    if (!order) {
      return { success: false, message: '订单不存在' };
    }

    if (order.payment_status === PAYMENT_STATUS.PAID) {
      return { success: false, message: '订单已支付，不允许超时取消' };
    }

    if (order.status === ORDER_STATUS.CANCELLED) {
      return { success: true, duplicate: true, message: '订单已取消' };
    }

    const releaseKey = this.generateIdempotentKey('release_timeout', orderId);
    const releaseResult = await InventoryService.releaseStock(order.product_id, order.quantity, orderId, releaseKey, 'system', '系统', '支付超时释放库存');
    if (!releaseResult.success && !releaseResult.duplicate) {
      return { success: false, message: releaseResult.message };
    }

    await run(`
      UPDATE flash_sale_orders 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [ORDER_STATUS.CANCELLED, orderId]);

    return { success: true, message: '超时取消成功，库存已释放' };
  }

  static async applyCompensation(orderId, applicantId, applicantName, applyReason) {
    const order = await get('SELECT * FROM flash_sale_orders WHERE id = ?', [orderId]);
    if (!order) {
      return { success: false, message: '订单不存在' };
    }

    const existingApplication = await get('SELECT * FROM compensation_applications WHERE order_id = ?', [orderId]);
    if (existingApplication) {
      if (existingApplication.status === COMPENSATION_STATUS.PENDING) {
        return { success: false, message: '已有待审批的补单申请' };
      } else if (existingApplication.status === COMPENSATION_STATUS.APPROVED) {
        return { success: false, message: '该订单补单已批准，不可重复申请' };
      }
    }

    if (order.payment_status === PAYMENT_STATUS.PAID) {
      return { success: false, message: '订单已支付，无需补单' };
    }

    const applicationId = uuidv4();
    const idempotentKey = this.generateIdempotentKey('compensation_apply', applicationId);

    await run(`
      INSERT INTO compensation_applications (id, order_id, applicant_id, applicant_name, apply_reason, idempotent_key)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [applicationId, orderId, applicantId, applicantName, applyReason, idempotentKey]);

    await run(`
      UPDATE flash_sale_orders 
      SET compensation_apply_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [orderId]);

    return { success: true, applicationId };
  }

  static async approveCompensation(applicationId, reviewerId, reviewerName, reviewRemark = '') {
    const application = await get('SELECT * FROM compensation_applications WHERE id = ?', [applicationId]);
    if (!application) {
      return { success: false, message: '申请不存在' };
    }

    if (application.status !== COMPENSATION_STATUS.PENDING) {
      return { success: false, message: '申请已处理' };
    }

    const order = await get('SELECT * FROM flash_sale_orders WHERE id = ?', [application.order_id]);
    if (!order) {
      return { success: false, message: '订单不存在' };
    }

    const lockKey = this.generateIdempotentKey('compensation_lock', applicationId);
    const lockResult = await InventoryService.compensationLockStock(order.product_id, order.quantity, lockKey, reviewerId, reviewerName, '补单审批通过锁库存');
    if (!lockResult.success) {
      return { success: false, message: lockResult.message };
    }

    await run(`
      UPDATE compensation_applications 
      SET status = ?, reviewer_id = ?, reviewer_name = ?, review_remark = ?, review_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [COMPENSATION_STATUS.APPROVED, reviewerId, reviewerName, reviewRemark, applicationId]);

    const confirmKey = this.generateIdempotentKey('compensation_confirm', applicationId);
    const confirmResult = await InventoryService.confirmStock(order.product_id, order.quantity, order.id, confirmKey, reviewerId, reviewerName, '补单确认扣库存');
    if (!confirmResult.success && !confirmResult.duplicate) {
      return { success: false, message: confirmResult.message };
    }

    const newOrderNo = this.generateOrderNo();
    const compensationTxnId = `COMP_${applicationId}`;
    await run(`
      UPDATE flash_sale_orders 
      SET is_manual_compensation = 1, 
          compensation_approve_time = CURRENT_TIMESTAMP, 
          order_no = ?, 
          status = ?, 
          payment_status = ?, 
          payment_time = CURRENT_TIMESTAMP,
          payment_transaction_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newOrderNo, ORDER_STATUS.CONFIRMED, PAYMENT_STATUS.PAID, compensationTxnId, order.id]);

    return { success: true, message: '补单审批通过' };
  }

  static async rejectCompensation(applicationId, reviewerId, reviewerName, rejectReason) {
    const application = await get('SELECT * FROM compensation_applications WHERE id = ?', [applicationId]);
    if (!application) {
      return { success: false, message: '申请不存在' };
    }

    if (application.status !== COMPENSATION_STATUS.PENDING) {
      return { success: false, message: '申请已处理' };
    }

    await run(`
      UPDATE compensation_applications 
      SET status = ?, reviewer_id = ?, reviewer_name = ?, review_remark = ?, review_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [COMPENSATION_STATUS.REJECTED, reviewerId, reviewerName, rejectReason, applicationId]);

    await run(`
      UPDATE flash_sale_orders 
      SET compensation_reject_time = CURRENT_TIMESTAMP, compensation_reject_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [rejectReason, application.order_id]);

    return { success: true, message: '补单已拒绝' };
  }

  static async shipOrder(orderId, trackingNo, operatorId, operatorName) {
    const order = await get('SELECT * FROM flash_sale_orders WHERE id = ?', [orderId]);
    if (!order) {
      return { success: false, message: '订单不存在' };
    }

    if (order.payment_status !== PAYMENT_STATUS.PAID) {
      return { success: false, message: '订单未支付，不能发货' };
    }

    if (order.shipping_status === SHIPPING_STATUS.SHIPPED) {
      return { success: false, message: '订单已发货' };
    }

    await run(`
      UPDATE flash_sale_orders 
      SET shipping_status = ?, shipping_time = CURRENT_TIMESTAMP, shipping_tracking_no = ?, operator_id = ?, operator_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [SHIPPING_STATUS.SHIPPED, trackingNo, operatorId, operatorName, orderId]);

    return { success: true, message: '发货成功' };
  }

  static async processRefund(orderId, refundAmount, operatorId, operatorName, returnStock = true) {
    const order = await get('SELECT * FROM flash_sale_orders WHERE id = ?', [orderId]);
    if (!order) {
      return { success: false, message: '订单不存在' };
    }

    if (order.refund_status === REFUND_STATUS.COMPLETED) {
      return { success: false, message: '订单已退款，不可重复退款' };
    }

    const idempotentKey = this.generateIdempotentKey('refund', orderId);

    if (returnStock) {
      const returnResult = await InventoryService.returnStockAfterRefund(order.product_id, order.quantity, orderId, idempotentKey, operatorId, operatorName, '退款退回库存');
      if (!returnResult.success && !returnResult.duplicate) {
        return { success: false, message: returnResult.message };
      }
    }

    await run(`
      UPDATE flash_sale_orders 
      SET refund_status = ?, refund_time = CURRENT_TIMESTAMP, refund_amount = ?, operator_id = ?, operator_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [REFUND_STATUS.COMPLETED, refundAmount, operatorId, operatorName, orderId]);

    return { success: true, message: '退款成功' };
  }

  static async getOrders(filters = {}, page = 1, pageSize = 20) {
    let whereConditions = [];
    let params = [];

    if (filters.activityId) {
      whereConditions.push('o.activity_id = ?');
      params.push(filters.activityId);
    }
    if (filters.status) {
      whereConditions.push('o.status = ?');
      params.push(filters.status);
    }
    if (filters.paymentStatus) {
      whereConditions.push('o.payment_status = ?');
      params.push(filters.paymentStatus);
    }
    if (filters.orderNo) {
      whereConditions.push('o.order_no LIKE ?');
      params.push(`%${filters.orderNo}%`);
    }
    if (filters.userName) {
      whereConditions.push('o.user_name LIKE ?');
      params.push(`%${filters.userName}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const orders = await all(`
      SELECT o.*, a.name as activity_name, p.name as product_name
      FROM flash_sale_orders o
      LEFT JOIN flash_sale_activities a ON o.activity_id = a.id
      LEFT JOIN flash_sale_products p ON o.product_id = p.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, pageSize, (page - 1) * pageSize]);

    const totalResult = await get(`
      SELECT COUNT(*) as count FROM flash_sale_orders o ${whereClause}
    `, params);

    return {
      list: orders,
      total: totalResult.count,
      page,
      pageSize
    };
  }

  static async getOrderDetail(orderId) {
    const order = await get(`
      SELECT o.*, a.name as activity_name, p.name as product_name, p.sku, p.flash_price
      FROM flash_sale_orders o
      LEFT JOIN flash_sale_activities a ON o.activity_id = a.id
      LEFT JOIN flash_sale_products p ON o.product_id = p.id
      WHERE o.id = ?
    `, [orderId]);

    if (!order) return null;

    const applications = await all('SELECT * FROM compensation_applications WHERE order_id = ? ORDER BY created_at DESC', [orderId]);
    const inventoryLogs = await all('SELECT * FROM inventory_change_logs WHERE order_id = ? ORDER BY created_at DESC', [orderId]);

    return {
      ...order,
      applications,
      inventoryLogs
    };
  }
}

module.exports = OrderService;
