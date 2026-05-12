const db = require('../models/database');
const EquipmentService = require('./equipmentService');
const { generateOrderNo, calculateDays } = require('../utils/helpers');

class OrderService {
  static async createOrder(data) {
    const { customer_id, customer_name, start_date, end_date, items, remarks } = data;
    
    return new Promise(async (resolve, reject) => {
      db.serialize(async () => {
        try {
          await new Promise((res, rej) => db.run('BEGIN TRANSACTION', (err) => err ? rej(err) : res()));
          
          const totalDays = calculateDays(start_date, end_date);
          let totalAmount = 0;
          let totalDeposit = 0;
          
          for (const item of items) {
            const availability = await EquipmentService.checkAvailability(item.equipment_id);
            if (!availability.available) {
              throw new Error(`设备 ${item.equipment_id} 不可用: ${availability.reason}`);
            }
            totalAmount += availability.equipment.daily_rate * totalDays;
            totalDeposit += availability.equipment.deposit_amount;
          }
          
          const orderNo = generateOrderNo();
          const orderId = await new Promise((res, rej) => {
            db.run(
              `INSERT INTO rental_orders 
               (order_no, customer_id, customer_name, start_date, end_date, total_days, total_amount, deposit_amount, remarks)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [orderNo, customer_id, customer_name, start_date, end_date, totalDays, totalAmount, totalDeposit, remarks],
              function(err) { err ? rej(err) : res(this.lastID); }
            );
          });
          
          for (const item of items) {
            const equipment = await EquipmentService.getEquipmentById(item.equipment_id);
            await new Promise((res, rej) => {
              db.run(
                `INSERT INTO order_items (order_id, equipment_id, equipment_code, daily_rate, status)
                 VALUES (?, ?, ?, ?, 'reserved')`,
                [orderId, item.equipment_id, equipment.equipment_code, equipment.daily_rate],
                (err) => err ? rej(err) : res()
              );
            });
            
            await new Promise((res, rej) => {
              db.run(
                `INSERT INTO stock_locks (equipment_id, order_id, lock_type, lock_reason, locked_by)
                 VALUES (?, ?, 'reservation', '订单预订', ?)`,
                [item.equipment_id, orderId, customer_name],
                (err) => err ? rej(err) : res()
              );
            });
          }
          
          await new Promise((res, rej) => db.run('COMMIT', (err) => err ? rej(err) : res()));
          
          const order = await this.getOrderById(orderId);
          resolve(order);
        } catch (error) {
          await new Promise((res) => db.run('ROLLBACK', () => res()));
          reject(error);
        }
      });
    });
  }

  static async getOrderById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM rental_orders WHERE id = ?', [id], async (err, order) => {
        if (err) reject(err);
        else if (!order) resolve(null);
        else {
          const items = await new Promise((res, rej) => {
            db.all('SELECT * FROM order_items WHERE order_id = ?', [id], (err, rows) => err ? rej(err) : res(rows));
          });
          const stockLocks = await new Promise((res, rej) => {
            db.all('SELECT * FROM stock_locks WHERE order_id = ? AND is_active = 1', [id], (err, rows) => err ? rej(err) : res(rows));
          });
          resolve({ ...order, items, stock_locks: stockLocks });
        }
      });
    });
  }

  static async getOrderByNo(orderNo) {
    return new Promise((resolve, reject) => {
      db.get('SELECT id FROM rental_orders WHERE order_no = ?', [orderNo], async (err, row) => {
        if (err) reject(err);
        else if (!row) resolve(null);
        else resolve(await this.getOrderById(row.id));
      });
    });
  }

  static async listOrders(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM rental_orders WHERE 1=1';
      const params = [];
      
      if (filters.customer_id) {
        sql += ' AND customer_id = ?';
        params.push(filters.customer_id);
      }
      if (filters.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
      }
      
      sql += ' ORDER BY created_at DESC';
      
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async updateOrderStatus(id, status) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE rental_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, id],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  static async checkOrderExtensionConflict(orderId, newEndDate) {
    const order = await this.getOrderById(orderId);
    if (!order) return { conflict: true, reason: '订单不存在' };
    
    if (order.status === 'completed' || order.status === 'cancelled') {
      return { conflict: true, reason: '订单已完成或已取消，不能延期' };
    }
    
    if (new Date(newEndDate) <= new Date(order.end_date)) {
      return { conflict: true, reason: '新的结束日期必须晚于原结束日期' };
    }
    
    for (const item of order.items) {
      const conflictingLocks = await new Promise((resolve, reject) => {
        db.all(
          `SELECT sl.*, ro.order_no, ro.customer_name 
           FROM stock_locks sl
           JOIN rental_orders ro ON sl.order_id = ro.id
           WHERE sl.equipment_id = ? AND sl.order_id != ? AND sl.is_active = 1
             AND ro.start_date <= ? AND ro.end_date >= ?`,
          [item.equipment_id, orderId, newEndDate, order.end_date],
          (err, rows) => err ? reject(err) : resolve(rows)
        );
      });
      
      if (conflictingLocks.length > 0) {
        return {
          conflict: true,
          reason: `设备 ${item.equipment_code} 在延期期间有冲突订单`,
          conflicts: conflictingLocks
        };
      }
    }
    
    return { conflict: false };
  }
}

module.exports = OrderService;
