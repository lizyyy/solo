const db = require('../config/database');

class QuarantineSessionDao {
  static all(activeOnly = false) {
    const query = activeOnly
      ? 'SELECT * FROM quarantine_sessions WHERE status = "active" ORDER BY created_at DESC'
      : 'SELECT * FROM quarantine_sessions ORDER BY created_at DESC';
    return new Promise((resolve, reject) => {
      db.all(query, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static getById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM quarantine_sessions WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static getActiveByFishGroupId(fishGroupId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM quarantine_sessions WHERE fish_group_id = ? AND status = "active"',
        [fishGroupId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  static create(data) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO quarantine_sessions 
         (id, fish_group_id, tank_id, start_date, planned_end_date, disease, rule_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          data.id,
          data.fishGroupId,
          data.tankId,
          data.startDate,
          data.plannedEndDate || null,
          data.disease || null,
          data.ruleId || null
        ],
        function(err) {
          if (err) return reject(err);
          db.get(
            'SELECT * FROM quarantine_sessions WHERE id = ?',
            [data.id],
            (queryErr, row) => {
              if (queryErr) reject(queryErr);
              else resolve(row);
            }
          );
        }
      );
    });
  }

  static complete(id, actualEndDate = null) {
    return new Promise((resolve, reject) => {
      const endDate = actualEndDate || new Date().toISOString().split('T')[0];
      db.run(
        'UPDATE quarantine_sessions SET status = "completed", actual_end_date = ? WHERE id = ?',
        [endDate, id],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  }

  static cancel(id) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE quarantine_sessions SET status = "cancelled" WHERE id = ?',
        [id],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  }
}

module.exports = QuarantineSessionDao;
