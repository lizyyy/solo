const db = require('../models/database');
const OrderService = require('./orderService');
const EquipmentService = require('./equipmentService');
const { generateReturnNo } = require('../utils/helpers');

class ReturnService {
  static async createReturn(data) {
    const { order_id, warehouse, operator, remarks } = data;
    
    return new Promise(async (resolve, reject) => {
      db.serialize(async () => {
        try {
          await new Promise((res, rej) => db.run('BEGIN TRANSACTION', (err) => err ? rej(err) : res()));
          
          const order = await OrderService.getOrderById(order_id);
          if (!order) {
            throw new Error('订单不存在');
          }
          
          if (order.status !== 'rented') {
            throw new Error('只有租赁中的订单才能归还');
          }
          
          const existingReturn = await new Promise((resolve, reject) => {
            db.get(
              'SELECT * FROM returns WHERE order_id = ? AND status != ?',
              [order_id, 'cancelled'],
              (err, row) => err ? reject(err) : resolve(row)
            );
          });
          
          if (existingReturn) {
            throw new Error('该订单已有归还记录');
          }
          
          const returnNo = generateReturnNo();
          const returnId = await new Promise((res, rej) => {
            db.run(
              `INSERT INTO returns (return_no, order_id, warehouse, operator, status, remarks)
               VALUES (?, ?, ?, ?, 'pending', ?)`,
              [returnNo, order_id, warehouse, operator, remarks],
              function(err) { err ? rej(err) : res(this.lastID); }
            );
          });
          
          for (const item of order.items) {
            await new Promise((res, rej) => {
              db.run(
                `INSERT INTO return_items (return_id, order_item_id, equipment_id, equipment_code)
                 VALUES (?, ?, ?, ?)`,
                [returnId, item.id, item.equipment_id, item.equipment_code],
                (err) => err ? rej(err) : res()
              );
            });
          }
          
          await new Promise((res, rej) => db.run('COMMIT', (err) => err ? rej(err) : res()));
          
          const returnRecord = await this.getReturnById(returnId);
          resolve(returnRecord);
        } catch (error) {
          await new Promise((res) => db.run('ROLLBACK', () => res()));
          reject(error);
        }
      });
    });
  }

  static async confirmReturn(returnId, damageFee = 0) {
    return new Promise(async (resolve, reject) => {
      db.serialize(async () => {
        try {
          await new Promise((res, rej) => db.run('BEGIN TRANSACTION', (err) => err ? rej(err) : res()));
          
          const returnRecord = await this.getReturnById(returnId);
          if (!returnRecord) {
            throw new Error('归还记录不存在');
          }
          
          if (returnRecord.status !== 'pending') {
            throw new Error('该归还已确认');
          }
          
          await new Promise((res, rej) => {
            db.run(
              'UPDATE returns SET status = ?, return_date = CURRENT_TIMESTAMP, damage_fee = ? WHERE id = ?',
              ['completed', damageFee, returnId],
              (err) => err ? rej(err) : res()
            );
          });
          
          await new Promise((res, rej) => {
            db.run(
              'UPDATE return_items SET confirmed = 1, condition = ? WHERE return_id = ?',
              [damageFee > 0 ? 'damaged' : 'good', returnId],
              (err) => err ? rej(err) : res()
            );
          });
          
          await new Promise((res, rej) => {
            db.run(
              'UPDATE stock_locks SET is_active = 0, released_at = CURRENT_TIMESTAMP WHERE order_id = ? AND is_active = 1',
              [returnRecord.order_id],
              (err) => err ? rej(err) : res()
            );
          });
          
          const order = await OrderService.getOrderById(returnRecord.order_id);
          for (const item of order.items) {
            await EquipmentService.updateEquipmentStatus(item.equipment_id, 'available');
          }
          
          await new Promise((res, rej) => {
            db.run(
              'UPDATE order_items SET status = ? WHERE order_id = ?',
              ['returned', returnRecord.order_id],
              (err) => err ? rej(err) : res()
            );
          });
          
          await new Promise((res, rej) => {
            db.run(
              'UPDATE rental_orders SET status = ?, actual_end_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              ['completed', returnRecord.order_id],
              (err) => err ? rej(err) : res()
            );
          });
          
          await new Promise((res, rej) => db.run('COMMIT', (err) => err ? rej(err) : res()));
          
          const updatedReturn = await this.getReturnById(returnId);
          resolve(updatedReturn);
        } catch (error) {
          await new Promise((res) => db.run('ROLLBACK', () => res()));
          reject(error);
        }
      });
    });
  }

  static async getReturnById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM returns WHERE id = ?', [id], async (err, returnRecord) => {
        if (err) reject(err);
        else if (!returnRecord) resolve(null);
        else {
          const items = await new Promise((res, rej) => {
            db.all('SELECT * FROM return_items WHERE return_id = ?', [id], (err, rows) => err ? rej(err) : res(rows));
          });
          resolve({ ...returnRecord, items });
        }
      });
    });
  }
}

module.exports = ReturnService;
