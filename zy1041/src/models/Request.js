const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Request {
  static create(data) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const {
        requester_id,
        pickup_location,
        dropoff_location,
        item_type,
        weight = 0,
        volume = 0,
        latest_delivery_time,
        tip_amount = 0,
        notes
      } = data;

      const sql = `INSERT INTO requests 
        (id, requester_id, pickup_location, dropoff_location, item_type, weight, volume, latest_delivery_time, tip_amount, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`;

      db.run(sql, [
        id, requester_id, pickup_location, dropoff_location, item_type,
        weight, volume, latest_delivery_time, tip_amount, notes
      ], function(err) {
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
      db.get('SELECT * FROM requests WHERE id = ?', [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  static findByRequesterId(requester_id) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM requests WHERE requester_id = ? ORDER BY created_at DESC', [requester_id], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  static findAllPending() {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM requests 
              WHERE status = 'pending' 
              ORDER BY created_at ASC`, (err, rows) => {
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
      const sql = `UPDATE requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
      db.run(sql, [status, id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  static findAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM requests ORDER BY created_at DESC', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}

module.exports = Request;
