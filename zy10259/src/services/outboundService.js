const db = require('../models/database');
const OrderService = require('./orderService');
const EquipmentService = require('./equipmentService');
const { generateOutboundNo } = require('../utils/helpers');

class OutboundService {
  static async createOutbound(data) {
    const { order_id, warehouse, operator, remarks } = data;
    
    return new Promise(async (resolve, reject) => {
      db.serialize(async () => {
        try {
          await new Promise((res, rej) => db.run('BEGIN TRANSACTION', (err) => err ? rej(err) : res()));
          
          const order = await OrderService.getOrderById(order_id);
          if (!order) {
            throw new Error('订单不存在');
          }
          
          if (order.status !== 'pending') {
            throw new Error('订单状态不正确，无法出库');
          }
          
          const existingOutbound = await new Promise((resolve, reject) => {
            db.get(
              'SELECT * FROM outbounds WHERE order_id = ? AND status != ?',
              [order_id, 'cancelled'],
              (err, row) => err ? reject(err) : resolve(row)
            );
          });
          
          if (existingOutbound) {
            throw new Error('该订单已有出库记录');
          }
          
          const outboundNo = generateOutboundNo();
          const outboundId = await new Promise((res, rej) => {
            db.run(
              `INSERT INTO outbounds (outbound_no, order_id, warehouse, operator, status, remarks)
               VALUES (?, ?, ?, ?, 'pending', ?)`,
              [outboundNo, order_id, warehouse, operator, remarks],
              function(err) { err ? rej(err) : res(this.lastID); }
            );
          });
          
          for (const item of order.items) {
            await new Promise((res, rej) => {
              db.run(
                `INSERT INTO outbound_items (outbound_id, order_item_id, equipment_id, equipment_code)
                 VALUES (?, ?, ?, ?)`,
                [outboundId, item.id, item.equipment_id, item.equipment_code],
                (err) => err ? rej(err) : res()
              );
            });
          }
          
          await new Promise((res, rej) => db.run('COMMIT', (err) => err ? rej(err) : res()));
          
          const outbound = await this.getOutboundById(outboundId);
          resolve(outbound);
        } catch (error) {
          await new Promise((res) => db.run('ROLLBACK', () => res()));
          reject(error);
        }
      });
    });
  }

  static async confirmOutbound(outboundId) {
    return new Promise(async (resolve, reject) => {
      db.serialize(async () => {
        try {
          await new Promise((res, rej) => db.run('BEGIN TRANSACTION', (err) => err ? rej(err) : res()));
          
          const outbound = await this.getOutboundById(outboundId);
          if (!outbound) {
            throw new Error('出库记录不存在');
          }
          
          if (outbound.status !== 'pending') {
            throw new Error('该出库已确认');
          }
          
          await new Promise((res, rej) => {
            db.run(
              'UPDATE outbounds SET status = ?, outbound_date = CURRENT_TIMESTAMP WHERE id = ?',
              ['completed', outboundId],
              (err) => err ? rej(err) : res()
            );
          });
          
          await new Promise((res, rej) => {
            db.run(
              'UPDATE outbound_items SET confirmed = 1 WHERE outbound_id = ?',
              [outboundId],
              (err) => err ? rej(err) : res()
            );
          });
          
          await new Promise((res, rej) => {
            db.run(
              'UPDATE order_items SET status = ? WHERE order_id = (SELECT order_id FROM outbounds WHERE id = ?)',
              ['rented', outboundId],
              (err) => err ? rej(err) : res()
            );
          });
          
          const order = await OrderService.getOrderById(outbound.order_id);
          for (const item of order.items) {
            await EquipmentService.updateEquipmentStatus(item.equipment_id, 'rented');
          }
          
          await OrderService.updateOrderStatus(outbound.order_id, 'rented');
          
          await new Promise((res, rej) => db.run('COMMIT', (err) => err ? rej(err) : res()));
          
          const updatedOutbound = await this.getOutboundById(outboundId);
          resolve(updatedOutbound);
        } catch (error) {
          await new Promise((res) => db.run('ROLLBACK', () => res()));
          reject(error);
        }
      });
    });
  }

  static async getOutboundById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM outbounds WHERE id = ?', [id], async (err, outbound) => {
        if (err) reject(err);
        else if (!outbound) resolve(null);
        else {
          const items = await new Promise((res, rej) => {
            db.all('SELECT * FROM outbound_items WHERE outbound_id = ?', [id], (err, rows) => err ? rej(err) : res(rows));
          });
          resolve({ ...outbound, items });
        }
      });
    });
  }
}

module.exports = OutboundService;
