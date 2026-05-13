const db = require('../models/database');
const LogService = require('./LogService');

class OrderService {
  static async create(data, operatorId, operatorName) {
    return new Promise((resolve, reject) => {
      const { employee_id, order_date, meal_type, amount, restaurant } = data;
      
      if (!employee_id || !order_date || !meal_type || !amount) {
        return reject(new Error('缺少必填字段'));
      }

      if (amount <= 0) {
        return reject(new Error('订单金额必须大于0'));
      }

      const sql = `INSERT INTO meal_orders (employee_id, order_date, meal_type, amount, restaurant, status) VALUES (?, ?, ?, ?, ?, 'pending')`;
      db.run(sql, [employee_id, order_date, meal_type, amount, restaurant || null], async function(err) {
        if (err) return reject(err);

        const orderId = this.lastID;
        await LogService.logOperation('order', orderId, 'create', operatorId, operatorName, null, data);
        
        resolve({ id: orderId, ...data, status: 'pending' });
      });
    });
  }

  static async update(id, data, operatorId, operatorName) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM meal_orders WHERE id = ?`, [id], async (err, oldOrder) => {
        if (err) return reject(err);
        if (!oldOrder) return reject(new Error('订单不存在'));

        const updates = [];
        const params = [];
        const fields = ['meal_type', 'amount', 'restaurant', 'status'];

        fields.forEach(field => {
          if (data[field] !== undefined) {
            updates.push(`${field} = ?`);
            params.push(data[field]);
          }
        });

        if (updates.length === 0) {
          return resolve(oldOrder);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        const sql = `UPDATE meal_orders SET ${updates.join(', ')} WHERE id = ?`;
        db.run(sql, params, async function(err) {
          if (err) return reject(err);

          await LogService.logOperation('order', id, 'update', operatorId, operatorName, oldOrder, data);

          for (const field of fields) {
            if (data[field] !== undefined && oldOrder[field] !== data[field]) {
              await LogService.logModification('order', id, field, oldOrder[field], data[field], operatorId, operatorName);
            }
          }

          db.get(`SELECT * FROM meal_orders WHERE id = ?`, [id], (err, newOrder) => {
            if (err) reject(err);
            else resolve(newOrder);
          });
        });
      });
    });
  }

  static getById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM meal_orders WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static getAll() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT o.*, e.name as employee_name FROM meal_orders o LEFT JOIN employees e ON o.employee_id = e.id ORDER BY o.created_at DESC`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static getByEmployeeAndDate(employeeId, date) {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM meal_orders WHERE employee_id = ? AND order_date = ?`, [employeeId, date], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = OrderService;
