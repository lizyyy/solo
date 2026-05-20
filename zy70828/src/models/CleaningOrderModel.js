const { runAsync, getAsync, allAsync } = require('../utils/db');
const moment = require('moment');

class CleaningOrderModel {
  static async create(orderData) {
    const sql = `INSERT OR REPLACE INTO cleaning_orders 
      (order_id, bed_no, ward, assigned_to, status, timeout_hours, is_timeout) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`;
    return runAsync(sql, [
      orderData.order_id, orderData.bed_no, orderData.ward,
      orderData.assigned_to, orderData.status || 'pending',
      orderData.timeout_hours || 2, 0
    ]);
  }

  static async findByOrderId(orderId) {
    return getAsync('SELECT * FROM cleaning_orders WHERE order_id = ?', [orderId]);
  }

  static async findByBedNo(bedNo) {
    return allAsync('SELECT * FROM cleaning_orders WHERE bed_no = ? ORDER BY created_at DESC', [bedNo]);
  }

  static async findByWard(ward) {
    return allAsync('SELECT * FROM cleaning_orders WHERE ward = ? ORDER BY created_at DESC', [ward]);
  }

  static async startOrder(orderId, startTime = null) {
    const sql = `UPDATE cleaning_orders SET status = 'processing', started_at = ? WHERE order_id = ?`;
    return runAsync(sql, [startTime || moment().format('YYYY-MM-DD HH:mm:ss'), orderId]);
  }

  static async completeOrder(orderId, completeTime = null) {
    const sql = `UPDATE cleaning_orders SET status = 'completed', completed_at = ? WHERE order_id = ?`;
    return runAsync(sql, [completeTime || moment().format('YYYY-MM-DD HH:mm:ss'), orderId]);
  }

  static async checkTimeout(orderId) {
    const order = await this.findByOrderId(orderId);
    if (!order || order.status === 'completed') return false;

    const createdAt = moment(order.created_at);
    const now = moment();
    const diffHours = now.diff(createdAt, 'hours');

    if (diffHours >= order.timeout_hours) {
      await runAsync('UPDATE cleaning_orders SET is_timeout = 1 WHERE order_id = ?', [orderId]);
      return true;
    }
    return false;
  }

  static async getTimeoutOrders() {
    return allAsync(`SELECT * FROM cleaning_orders 
      WHERE status != 'completed' AND is_timeout = 1 
      ORDER BY created_at DESC`);
  }

  static async getAll() {
    return allAsync('SELECT * FROM cleaning_orders ORDER BY created_at DESC');
  }
}

module.exports = CleaningOrderModel;
