const db = require('../models/database');
const OrderService = require('./orderService');
const { generateExtensionNo, calculateDays, generateBillNo } = require('../utils/helpers');

class ExtensionService {
  static async createExtension(data) {
    const { order_id, new_end_date, remarks, created_by } = data;
    
    return new Promise(async (resolve, reject) => {
      db.serialize(async () => {
        try {
          await new Promise((res, rej) => db.run('BEGIN TRANSACTION', (err) => err ? rej(err) : res()));
          
          const order = await OrderService.getOrderById(order_id);
          if (!order) {
            throw new Error('订单不存在');
          }
          
          if (order.status === 'completed' || order.status === 'cancelled') {
            throw new Error('订单已完成或已取消，不能延期');
          }
          
          if (order.status === 'pending_return' && order.actual_end_date) {
            throw new Error('设备已归还，不能申请延期');
          }
          
          const conflictCheck = await OrderService.checkOrderExtensionConflict(order_id, new_end_date);
          if (conflictCheck.conflict) {
            throw new Error(conflictCheck.reason);
          }
          
          const existingPending = await new Promise((resolve, reject) => {
            db.get(
              'SELECT * FROM extensions WHERE order_id = ? AND status = ?',
              [order_id, 'pending'],
              (err, row) => err ? reject(err) : resolve(row)
            );
          });
          
          if (existingPending) {
            throw new Error('该订单已有待审批的延期申请');
          }
          
          const originalEndDate = order.end_date;
          const extensionDays = calculateDays(originalEndDate, new_end_date) - 1;
          
          let extensionAmount = 0;
          for (const item of order.items) {
            extensionAmount += item.daily_rate * extensionDays;
          }
          
          const extensionNo = generateExtensionNo();
          const extensionId = await new Promise((res, rej) => {
            db.run(
              `INSERT INTO extensions 
               (extension_no, order_id, original_end_date, new_end_date, extension_days, extension_amount, status, remarks, created_by)
               VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
              [extensionNo, order_id, originalEndDate, new_end_date, extensionDays, extensionAmount, remarks, created_by],
              function(err) { err ? rej(err) : res(this.lastID); }
            );
          });
          
          await new Promise((res, rej) => db.run('COMMIT', (err) => err ? rej(err) : res()));
          
          const extension = await this.getExtensionById(extensionId);
          resolve(extension);
        } catch (error) {
          await new Promise((res) => db.run('ROLLBACK', () => res()));
          reject(error);
        }
      });
    });
  }

  static async approveExtension(extensionId, approvedBy) {
    return new Promise(async (resolve, reject) => {
      db.serialize(async () => {
        try {
          await new Promise((res, rej) => db.run('BEGIN TRANSACTION', (err) => err ? rej(err) : res()));
          
          const extension = await this.getExtensionById(extensionId);
          if (!extension) {
            throw new Error('延期记录不存在');
          }
          
          if (extension.status !== 'pending') {
            throw new Error('该延期申请已处理');
          }
          
          const order = await OrderService.getOrderById(extension.order_id);
          
          const conflictCheck = await OrderService.checkOrderExtensionConflict(extension.order_id, extension.new_end_date);
          if (conflictCheck.conflict) {
            throw new Error(conflictCheck.reason);
          }
          
          await new Promise((res, rej) => {
            db.run(
              'UPDATE extensions SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?',
              ['approved', approvedBy, extensionId],
              (err) => err ? rej(err) : res()
            );
          });
          
          const newTotalDays = order.total_days + extension.extension_days;
          const newTotalAmount = order.total_amount + extension.extension_amount;
          
          await new Promise((res, rej) => {
            db.run(
              'UPDATE rental_orders SET end_date = ?, total_days = ?, total_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [extension.new_end_date, newTotalDays, newTotalAmount, extension.order_id],
              (err) => err ? rej(err) : res()
            );
          });
          
          const billNo = generateBillNo();
          await new Promise((res, rej) => {
            db.run(
              `INSERT INTO bills (bill_no, order_id, bill_type, amount, status, remarks)
               VALUES (?, ?, 'extension', ?, 'unpaid', ?)`,
              [billNo, extension.order_id, extension.extension_amount, `延期${extension.extension_days}天费用`],
              (err) => err ? rej(err) : res()
            );
          });
          
          await new Promise((res, rej) => db.run('COMMIT', (err) => err ? rej(err) : res()));
          
          const updatedExtension = await this.getExtensionById(extensionId);
          const updatedOrder = await OrderService.getOrderById(extension.order_id);
          resolve({ extension: updatedExtension, order: updatedOrder });
        } catch (error) {
          await new Promise((res) => db.run('ROLLBACK', () => res()));
          reject(error);
        }
      });
    });
  }

  static async getExtensionById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM extensions WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getExtensionsByOrderId(orderId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM extensions WHERE order_id = ? ORDER BY created_at DESC', [orderId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = ExtensionService;
