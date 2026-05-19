const { getDb } = require('../src/database');

class Order {
  static create(data) {
    return new Promise((resolve, reject) => {
      const db = getDb();
      const stmt = db.prepare(`
        INSERT INTO orders (order_no, user_id, user_name, phone, product_id, product_name, quantity, price, total_amount, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        data.order_no,
        data.user_id,
        data.user_name,
        data.phone || '',
        data.product_id,
        data.product_name,
        data.quantity,
        data.price,
        data.total_amount || (data.quantity * data.price),
        data.status || 'pending',
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  static findByOrderNo(orderNo) {
    return new Promise((resolve, reject) => {
      const db = getDb();
      db.get('SELECT * FROM orders WHERE order_no = ?', [orderNo], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static findAll() {
    return new Promise((resolve, reject) => {
      const db = getDb();
      db.all('SELECT * FROM orders ORDER BY created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static updateStatus(id, newStatus) {
    return new Promise((resolve, reject) => {
      const db = getDb();
      db.serialize(() => {
        db.get('SELECT status FROM orders WHERE id = ?', [id], (err, oldOrder) => {
          if (err) {
            reject(err);
            return;
          }
          const oldStatus = oldOrder ? oldOrder.status : null;
          
          db.run('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, id], (err) => {
            if (err) {
              reject(err);
              return;
            }
            
            db.run(`
              INSERT INTO status_history (entity_type, entity_id, old_status, new_status)
              VALUES (?, ?, ?, ?)
            `, ['order', id, oldStatus, newStatus], (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        });
      });
    });
  }

  static findByProductId(productId) {
    return new Promise((resolve, reject) => {
      const db = getDb();
      db.all('SELECT * FROM orders WHERE product_id = ? AND status = "pending"', [productId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = Order;
