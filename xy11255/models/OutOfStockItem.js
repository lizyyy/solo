const { getDb } = require('../src/database');

class OutOfStockItem {
  static create(data) {
    return new Promise((resolve, reject) => {
      const db = getDb();
      const stmt = db.prepare(`
        INSERT INTO out_of_stock_items (product_id, product_name, stock_quantity, affected_orders)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(
        data.product_id,
        data.product_name,
        data.stock_quantity || 0,
        data.affected_orders || 0,
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  static findAll() {
    return new Promise((resolve, reject) => {
      const db = getDb();
      db.all('SELECT * FROM out_of_stock_items ORDER BY created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static findByProductId(productId) {
    return new Promise((resolve, reject) => {
      const db = getDb();
      db.get('SELECT * FROM out_of_stock_items WHERE product_id = ?', [productId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
}

module.exports = OutOfStockItem;
