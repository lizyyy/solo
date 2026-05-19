const db = require('../database');
const logService = require('./logService');
const batchService = require('./batchService');
const moment = require('moment');

class CompensationService {
  async createCompensation(orderId, type, options = {}) {
    const { orderItemId, amount, reason, operator = 'system' } = options;

    const order = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      throw new Error('订单不存在');
    }

    const existingCompensation = await db.get(
      `SELECT * FROM compensations 
       WHERE order_id = ? AND order_item_id = ? AND type = ? AND status = 'confirmed'`,
      [orderId, orderItemId || null, type]
    );

    if (existingCompensation) {
      await logService.log('compensation', 'skip', '该商品已存在相同类型的补偿', {
        orderId,
        orderItemId,
        compensationId: existingCompensation.id,
        operator,
        details: { type }
      });
      return {
        id: existingCompensation.id,
        status: 'skipped',
        reason: '该商品已存在相同类型的补偿'
      };
    }

    const compensationId = db.generateId();
    const now = db.now();
    let couponId = null;

    if (type === 'coupon') {
      const coupon = await this.createCoupon({
        userId: order.user_id,
        orderId,
        compensationId,
        amount: amount || this.calculateCouponAmount(order, orderItemId),
        validDays: 30
      }, operator);
      couponId = coupon.id;
    }

    await db.run(
      `INSERT INTO compensations (
        id, order_id, order_item_id, type, amount, coupon_id, status, reason, operator, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [compensationId, orderId, orderItemId || null, type, amount || 0, couponId, reason, operator, now, now]
    );

    await logService.log('compensation', 'pending', `创建${this.getTypeName(type)}补偿`, {
      orderId,
      orderItemId,
      compensationId,
      couponId,
      operator,
      details: { type, amount, reason }
    });

    return { id: compensationId, status: 'pending' };
  }

  async confirmCompensation(compensationId, operator = 'system') {
    const compensation = await db.get('SELECT * FROM compensations WHERE id = ?', [compensationId]);
    if (!compensation) {
      throw new Error('补偿记录不存在');
    }

    if (compensation.status === 'confirmed') {
      await logService.log('confirm_compensation', 'skip', '补偿已确认，跳过', {
        compensationId,
        operator
      });
      return { status: 'skipped', reason: '补偿已确认' };
    }

    if (compensation.status === 'rolled_back') {
      throw new Error('补偿已回滚，无法确认');
    }

    await db.run(
      `UPDATE compensations SET status = 'confirmed', confirmed_at = ?, updated_at = ? WHERE id = ?`,
      [db.now(), db.now(), compensationId]
    );

    if (compensation.order_item_id) {
      await db.run(
        `UPDATE order_items SET compensation_status = ?, updated_at = ? WHERE id = ?`,
        [compensation.type, db.now(), compensation.order_item_id]
      );
    }

    if (compensation.coupon_id) {
      await db.run(
        `UPDATE coupons SET status = 'active', updated_at = ? WHERE id = ?`,
        [db.now(), compensation.coupon_id]
      );
    }

    await logService.log('confirm_compensation', 'success', '补偿确认成功', {
      orderId: compensation.order_id,
      orderItemId: compensation.order_item_id,
      compensationId,
      operator
    });

    return { status: 'confirmed' };
  }

  async rollbackCompensation(compensationId, reason, operator = 'system') {
    const compensation = await db.get('SELECT * FROM compensations WHERE id = ?', [compensationId]);
    if (!compensation) {
      throw new Error('补偿记录不存在');
    }

    if (compensation.status === 'rolled_back') {
      await logService.log('rollback_compensation', 'skip', '补偿已回滚，跳过', {
        compensationId,
        operator
      });
      return { status: 'skipped', reason: '补偿已回滚' };
    }

    await db.run(
      `UPDATE compensations SET status = 'rolled_back', rolled_back_at = ?, updated_at = ? WHERE id = ?`,
      [db.now(), db.now(), compensationId]
    );

    if (compensation.order_item_id) {
      await db.run(
        `UPDATE order_items SET compensation_status = 'none', updated_at = ? WHERE id = ?`,
        [db.now(), compensation.order_item_id]
      );
    }

    if (compensation.coupon_id) {
      await db.run(
        `UPDATE coupons SET status = 'invalid', updated_at = ? WHERE id = ?`,
        [db.now(), compensation.coupon_id]
      );
    }

    await logService.log('rollback_compensation', 'success', `补偿回滚: ${reason}`, {
      orderId: compensation.order_id,
      orderItemId: compensation.order_item_id,
      compensationId,
      operator,
      details: { reason }
    });

    return { status: 'rolled_back' };
  }

  async batchCompensate(orderIds, type, options = {}) {
    const { reason, operator = 'system' } = options;
    const { batchId, batchNo } = await batchService.createBatch('batch_compensation', orderIds.length);

    const successItems = [];
    const failItems = [];

    for (const orderId of orderIds) {
      try {
        const result = await this.createCompensation(orderId, type, {
          reason,
          operator,
          amount: options.amount
        });

        if (result.status === 'skipped') {
          await batchService.addBatchItem(batchId, orderId, 'success', result.reason);
          successItems.push({ orderId, status: 'skipped', reason: result.reason });
        } else {
          await this.confirmCompensation(result.id, operator);
          await batchService.addBatchItem(batchId, orderId, 'success', '补偿成功');
          successItems.push({ orderId, status: 'success', compensationId: result.id });
        }
      } catch (error) {
        await batchService.addBatchItem(batchId, orderId, 'fail', error.message);
        failItems.push({ orderId, error: error.message });
      }
    }

    const batchResult = await batchService.completeBatch(batchId);

    return {
      batchId,
      batchNo,
      total: orderIds.length,
      success: successItems.length,
      fail: failItems.length,
      successItems,
      failItems
    };
  }

  async createCoupon(options, operator) {
    const { userId, orderId, compensationId, amount, minSpend = 0, validDays = 30 } = options;
    const couponId = db.generateId();
    const code = `CPN${Date.now()}${Math.floor(Math.random() * 10000)}`;
    const now = db.now();
    const validFrom = moment().format('YYYY-MM-DD HH:mm:ss');
    const validTo = moment().add(validDays, 'days').format('YYYY-MM-DD HH:mm:ss');

    await db.run(
      `INSERT INTO coupons (
        id, code, user_id, order_id, compensation_id, amount, min_spend, status, valid_from, valid_to, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'unused', ?, ?, ?, ?)`,
      [couponId, code, userId, orderId || null, compensationId || null, amount, minSpend, validFrom, validTo, now, now]
    );

    await logService.log('create_coupon', 'success', '创建优惠券', {
      couponId,
      orderId,
      compensationId,
      operator,
      details: { code, amount, validTo }
    });

    return { id: couponId, code };
  }

  async expireCoupons() {
    const now = db.now();
    const expiredCoupons = await db.all(
      `SELECT * FROM coupons WHERE status IN ('unused', 'active') AND valid_to < ?`,
      [now]
    );

    for (const coupon of expiredCoupons) {
      await db.run(
        `UPDATE coupons SET status = 'expired', updated_at = ? WHERE id = ?`,
        [now, coupon.id]
      );

      await logService.log('expire_coupon', 'success', '优惠券已过期', {
        couponId: coupon.id,
        details: { validTo: coupon.valid_to }
      });
    }

    return { count: expiredCoupons.length };
  }

  calculateCouponAmount(order, orderItemId) {
    if (orderItemId) {
      return 5;
    }
    return Math.max(5, order.total_amount * 0.1);
  }

  getTypeName(type) {
    const names = {
      refund: '退款',
      exchange: '换货',
      coupon: '优惠券'
    };
    return names[type] || type;
  }
}

module.exports = new CompensationService();
