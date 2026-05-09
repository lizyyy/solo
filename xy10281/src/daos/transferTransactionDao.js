const db = require('../config/database');

class TransferTransactionDao {
  static all() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM transfer_transactions ORDER BY created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static getById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM transfer_transactions WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static getByFishGroupId(fishGroupId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM transfer_transactions WHERE fish_group_id = ? ORDER BY created_at DESC',
        [fishGroupId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static create(data) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO transfer_transactions 
         (id, fish_group_id, from_tank_id, to_tank_id, transfer_count, reason, status, scheduled_at, operator, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.id,
          data.fishGroupId,
          data.fromTankId || null,
          data.toTankId,
          data.transferCount,
          data.reason,
          data.status || 'pending',
          data.scheduledAt || null,
          data.operator || null,
          data.notes || null
        ],
        function(err) {
          if (err) reject(err);
          else resolve(data);
        }
      );
    });
  }

  static update(id, updates) {
    const setClauses = [];
    const values = [];
    
    if (updates.status) { setClauses.push('status = ?'); values.push(updates.status); }
    if (updates.executedAt) { setClauses.push('executed_at = ?'); values.push(updates.executedAt); }
    if (updates.operator) { setClauses.push('operator = ?'); values.push(updates.operator); }
    if (updates.notes) { setClauses.push('notes = ?'); values.push(updates.notes); }
    
    if (setClauses.length === 0) {
      return Promise.resolve();
    }
    
    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE transfer_transactions SET ${setClauses.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  }

  static updateStatus(id, status, executedAt = null) {
    const setClauses = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const values = [status];
    
    if (executedAt) {
      setClauses.push('executed_at = ?');
      values.push(executedAt);
    }
    values.push(id);
    
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE transfer_transactions SET ${setClauses.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  }
}

module.exports = TransferTransactionDao;
