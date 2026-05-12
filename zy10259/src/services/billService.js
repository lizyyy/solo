const db = require('../models/database');

class BillService {
  static async getBillsByOrderId(orderId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM bills WHERE order_id = ? ORDER BY created_at DESC', [orderId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getBillById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM bills WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async payBill(billId) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE bills SET status = ?, paid_date = CURRENT_TIMESTAMP WHERE id = ?',
        ['paid', billId],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  static async listBills(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM bills WHERE 1=1';
      const params = [];
      
      if (filters.order_id) {
        sql += ' AND order_id = ?';
        params.push(filters.order_id);
      }
      if (filters.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.bill_type) {
        sql += ' AND bill_type = ?';
        params.push(filters.bill_type);
      }
      
      sql += ' ORDER BY created_at DESC';
      
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = BillService;
