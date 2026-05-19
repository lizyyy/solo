const db = require('../database');
const logService = require('./logService');
const moment = require('moment');
const { Parser } = require('json2csv');

class SettlementService {
  async createSettlement(groupLeaderId, startDate, endDate, operator = 'system') {
    const settlementId = db.generateId();
    const settlementNo = `SET${Date.now()}`;
    const now = db.now();

    const orders = await db.all(
      `SELECT o.*, 
        COALESCE(SUM(CASE WHEN c.type = 'refund' AND c.status = 'confirmed' THEN c.amount ELSE 0 END), 0) as total_refund,
        COALESCE(SUM(CASE WHEN c.type = 'coupon' AND c.status = 'confirmed' THEN c.amount ELSE 0 END), 0) as total_coupon
       FROM orders o
       LEFT JOIN compensations c ON o.id = c.order_id
       WHERE o.group_leader_id = ? AND o.created_at >= ? AND o.created_at <= ?
       GROUP BY o.id`,
      [groupLeaderId, startDate, endDate]
    );

    const totalOrders = orders.length;
    const totalAmount = orders.reduce((sum, o) => sum + o.total_amount, 0);
    const totalRefund = orders.reduce((sum, o) => sum + o.total_refund, 0);
    const totalCoupon = orders.reduce((sum, o) => sum + o.total_coupon, 0);

    await db.run(
      `INSERT INTO settlements (
        id, settlement_no, group_leader_id, start_date, end_date,
        total_orders, total_amount, total_refund, total_coupon, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
      [settlementId, settlementNo, groupLeaderId, startDate, endDate,
       totalOrders, totalAmount, totalRefund, totalCoupon, now, now]
    );

    for (const order of orders) {
      await db.run(
        `INSERT INTO settlement_items (
          id, settlement_id, order_id, order_amount, refund_amount, coupon_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [db.generateId(), settlementId, order.id, order.total_amount,
         order.total_refund, order.total_coupon, now]
      );
    }

    await logService.log('create_settlement', 'success', '创建结算单', {
      operator,
      details: { settlementNo, groupLeaderId, startDate, endDate }
    });

    return { id: settlementId, settlementNo };
  }

  async confirmSettlement(settlementId, operator = 'system') {
    const settlement = await db.get('SELECT * FROM settlements WHERE id = ?', [settlementId]);
    if (!settlement) {
      throw new Error('结算单不存在');
    }

    if (settlement.status === 'confirmed') {
      return { status: 'skipped', reason: '结算单已确认' };
    }

    await db.run(
      `UPDATE settlements SET status = 'confirmed', confirmed_at = ?, updated_at = ? WHERE id = ?`,
      [db.now(), db.now(), settlementId]
    );

    await logService.log('confirm_settlement', 'success', '确认结算单', {
      operator,
      details: { settlementNo: settlement.settlement_no }
    });

    return { status: 'confirmed' };
  }

  async exportSettlement(settlementId) {
    const settlement = await db.get('SELECT * FROM settlements WHERE id = ?', [settlementId]);
    if (!settlement) {
      throw new Error('结算单不存在');
    }

    const items = await db.all(
      `SELECT 
        si.*,
        o.order_no,
        o.user_name,
        o.created_at as order_date
       FROM settlement_items si
       JOIN orders o ON si.order_id = o.id
       WHERE si.settlement_id = ?`,
      [settlementId]
    );

    const exportData = items.map(item => ({
      '结算单号': settlement.settlement_no,
      '订单号': item.order_no,
      '用户姓名': item.user_name,
      '下单时间': item.order_date,
      '订单金额': item.order_amount,
      '退款金额': item.refund_amount,
      '优惠券金额': item.coupon_amount,
      '实付金额': item.order_amount - item.refund_amount
    }));

    const summaryRow = {
      '结算单号': '合计',
      '订单号': '',
      '用户姓名': '',
      '下单时间': '',
      '订单金额': settlement.total_amount,
      '退款金额': settlement.total_refund,
      '优惠券金额': settlement.total_coupon,
      '实付金额': settlement.total_amount - settlement.total_refund
    };
    exportData.push(summaryRow);

    const parser = new Parser();
    const csv = parser.parse(exportData);

    return { csv, settlement };
  }

  async getSettlements(filters = {}) {
    let sql = 'SELECT * FROM settlements WHERE 1=1';
    const params = [];

    if (filters.group_leader_id) {
      sql += ' AND group_leader_id = ?';
      params.push(filters.group_leader_id);
    }

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY created_at DESC';

    return await db.all(sql, params);
  }

  async getSettlementDetail(settlementId) {
    const settlement = await db.get('SELECT * FROM settlements WHERE id = ?', [settlementId]);
    if (!settlement) return null;

    const items = await db.all(
      `SELECT 
        si.*,
        o.order_no,
        o.user_name
       FROM settlement_items si
       JOIN orders o ON si.order_id = o.id
       WHERE si.settlement_id = ?`,
      [settlementId]
    );

    return { settlement, items };
  }
}

module.exports = new SettlementService();
