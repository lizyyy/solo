const db = require('../config/database');

class ExceptionModel {
  static create(data) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO exceptions 
        (rental_id, exception_type, description, amount)
        VALUES (?, ?, ?, ?)
      `;
      const params = [data.rental_id, data.exception_type, data.description, data.amount];
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  static resolve(id, data) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE exceptions 
        SET is_resolved = 1,
            resolved_by = ?,
            resolved_at = CURRENT_TIMESTAMP,
            resolution_note = ?
        WHERE id = ?
      `;
      const params = [data.resolved_by, data.resolution_note, id];
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  static findByRentalId(rentalId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM exceptions WHERE rental_id = ? ORDER BY created_at DESC', [rentalId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static findUnresolved() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM exceptions WHERE is_resolved = 0 ORDER BY created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = ExceptionModel;
