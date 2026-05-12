const db = require('../models/database');
const OrderService = require('./orderService');
const EquipmentService = require('./equipmentService');
const { generateExchangeNo } = require('../utils/helpers');

class ExchangeService {
  static async createExchange(data) {
    const { order_id, old_equipment_id, new_equipment_id, remarks } = data;
    
    return new Promise(async (resolve, reject) => {
      db.serialize(async () => {
        try {
          await new Promise((res, rej) => db.run('BEGIN TRANSACTION', (err) => err ? rej(err) : res()));
          
          const order = await OrderService.getOrderById(order_id);
          if (!order) {
            throw new Error('订单不存在');
          }
          
          if (order.status !== 'rented') {
            throw new Error('只有租赁中的订单才能换机');
          }
          
          const oldItem = order.items.find(i => i.equipment_id === old_equipment_id);
          if (!oldItem) {
            throw new Error('原设备不在该订单中');
          }
          
          const newAvailability = await EquipmentService.checkAvailability(new_equipment_id);
          if (!newAvailability.available) {
            throw new Error(`新设备不可用: ${newAvailability.reason}`);
          }
          
          const pendingExchange = await new Promise((resolve, reject) => {
            db.get(
              'SELECT * FROM exchanges WHERE old_equipment_id = ? AND status = ?',
              [old_equipment_id, 'pending'],
              (err, row) => err ? reject(err) : resolve(row)
            );
          });
          
          if (pendingExchange) {
            throw new Error('该设备已有待处理的换机申请');
          }
          
          const exchangeNo = generateExchangeNo();
          const newEquipment = newAvailability.equipment;
          
          const exchangeId = await new Promise((res, rej) => {
            db.run(
              `INSERT INTO exchanges 
               (exchange_no, order_id, old_equipment_id, new_equipment_id, old_equipment_code, new_equipment_code, status, remarks)
               VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
              [exchangeNo, order_id, old_equipment_id, new_equipment_id, oldItem.equipment_code, newEquipment.equipment_code, remarks],
              function(err) { err ? rej(err) : res(this.lastID); }
            );
          });
          
          await new Promise((res, rej) => {
            db.run(
              `INSERT INTO stock_locks (equipment_id, order_id, lock_type, lock_reason, locked_by)
               VALUES (?, ?, 'exchange', '换机锁定', ?)`,
              [new_equipment_id, order_id, order.customer_name],
              (err) => err ? rej(err) : res()
            );
          });
          
          await new Promise((res, rej) => db.run('COMMIT', (err) => err ? rej(err) : res()));
          
          const exchange = await this.getExchangeById(exchangeId);
          resolve(exchange);
        } catch (error) {
          await new Promise((res) => db.run('ROLLBACK', () => res()));
          reject(error);
        }
      });
    });
  }

  static async confirmExchange(exchangeId) {
    return new Promise(async (resolve, reject) => {
      db.serialize(async () => {
        try {
          await new Promise((res, rej) => db.run('BEGIN TRANSACTION', (err) => err ? rej(err) : res()));
          
          const exchange = await this.getExchangeById(exchangeId);
          if (!exchange) {
            throw new Error('换机记录不存在');
          }
          
          if (exchange.status !== 'pending') {
            throw new Error('该换机已处理');
          }
          
          await new Promise((res, rej) => {
            db.run(
              'UPDATE exchanges SET status = ?, old_released = 1, new_outbound = 1, exchange_date = CURRENT_TIMESTAMP WHERE id = ?',
              ['completed', exchangeId],
              (err) => err ? rej(err) : res()
            );
          });
          
          await new Promise((res, rej) => {
            db.run(
              'UPDATE stock_locks SET is_active = 0, released_at = CURRENT_TIMESTAMP WHERE equipment_id = ? AND order_id = ? AND is_active = 1',
              [exchange.old_equipment_id, exchange.order_id],
              (err) => err ? rej(err) : res()
            );
          });
          
          await EquipmentService.updateEquipmentStatus(exchange.old_equipment_id, 'available');
          await EquipmentService.updateEquipmentStatus(exchange.new_equipment_id, 'rented');
          
          await new Promise((res, rej) => {
            db.run(
              'UPDATE order_items SET equipment_id = ?, equipment_code = ? WHERE order_id = ? AND equipment_id = ?',
              [exchange.new_equipment_id, exchange.new_equipment_code, exchange.order_id, exchange.old_equipment_id],
              (err) => err ? rej(err) : res()
            );
          });
          
          await new Promise((res, rej) => db.run('COMMIT', (err) => err ? rej(err) : res()));
          
          const updatedExchange = await this.getExchangeById(exchangeId);
          resolve(updatedExchange);
        } catch (error) {
          await new Promise((res) => db.run('ROLLBACK', () => res()));
          reject(error);
        }
      });
    });
  }

  static async getExchangeById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM exchanges WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getExchangesByOrderId(orderId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM exchanges WHERE order_id = ? ORDER BY created_at DESC', [orderId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = ExchangeService;
