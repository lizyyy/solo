const db = require('../config/database');

class TreatmentRecordDao {
  static all() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM treatment_records ORDER BY created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static getById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM treatment_records WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static getByFishGroupId(fishGroupId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM treatment_records WHERE fish_group_id = ? ORDER BY created_at DESC',
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
        `INSERT INTO treatment_records 
         (id, fish_group_id, tank_id, disease, treatment_plan, start_date, status, created_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.id,
          data.fishGroupId,
          data.tankId || null,
          data.disease,
          data.treatmentPlan || null,
          data.startDate,
          data.status || 'pending',
          data.createdBy || null,
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
    
    if (updates.tankId !== undefined) { setClauses.push('tank_id = ?'); values.push(updates.tankId); }
    if (updates.treatmentPlan) { setClauses.push('treatment_plan = ?'); values.push(updates.treatmentPlan); }
    if (updates.status) { setClauses.push('status = ?'); values.push(updates.status); }
    if (updates.endDate) { setClauses.push('end_date = ?'); values.push(updates.endDate); }
    if (updates.notes) { setClauses.push('notes = ?'); values.push(updates.notes); }
    
    if (setClauses.length === 0) {
      return Promise.resolve();
    }
    
    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE treatment_records SET ${setClauses.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  }
}

module.exports = TreatmentRecordDao;
