const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Order {
  static create(data) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const {
        request_id,
        trip_id,
        requester_id,
        traveler_id,
        tip_amount = 0,
        status = 'pending_matching'
      } = data;

      const sql = `INSERT INTO orders 
        (id, request_id, trip_id, requester_id, traveler_id, tip_amount, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)`;

      db.run(sql, [id, request_id, trip_id, requester_id, traveler_id, tip_amount, status], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, ...data });
        }
      });
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM orders WHERE id = ?', [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  static findByRequestId(request_id) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM orders WHERE request_id = ? ORDER BY created_at DESC', [request_id], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  static findByTripId(trip_id) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM orders WHERE trip_id = ? ORDER BY created_at DESC', [trip_id], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  static updateStatus(id, status) {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
      db.run(sql, [status, id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  static findActiveByRequestId(request_id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM orders 
              WHERE request_id = ? 
              AND status NOT IN ('delivered', 'cancelled', 'timeout_released')
              ORDER BY created_at DESC LIMIT 1`, [request_id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  static findAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM orders ORDER BY created_at DESC', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}

module.exports = Order;
