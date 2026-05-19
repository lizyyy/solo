const { getDb } = require('../src/database');

class ProcessingResult {
  static create(data) {
    return new Promise((resolve, reject) => {
      const db = getDb();
      const stmt = db.prepare(`
        INSERT INTO processing_results (order_id, order_no, compensation_type, compensation_value, status, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        data.order_id,
        data.order_no,
        data.compensation_type,
        data.compensation_value || 0,
        data.status || 'processed',
        data.notes || '',
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
      db.all('SELECT * FROM processing_results ORDER BY processed_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static findByOrderId(orderId) {
    return new Promise((resolve, reject) => {
      const db = getDb();
      db.all('SELECT * FROM processing_results WHERE order_id = ?', [orderId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static getStatistics() {
    return new Promise((resolve, reject) => {
      const db = getDb();
      db.all(`
        SELECT 
          compensation_type,
          COUNT(*) as count,
          SUM(compensation_value) as total_value
        FROM processing_results
        GROUP BY compensation_type
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = ProcessingResult;
