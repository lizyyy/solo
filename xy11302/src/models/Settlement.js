const db = require('../config/database');

class Settlement {
  static create(data) {
    return new Promise((resolve, reject) => {
      const { settlement_month, cleaner_name, total_cleanings, total_reworks, total_complaints, total_deduction, final_amount, status } = data;
      const sql = `INSERT INTO settlements 
        (settlement_month, cleaner_name, total_cleanings, total_reworks, total_complaints, total_deduction, final_amount, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      db.run(sql, [settlement_month, cleaner_name, total_cleanings || 0, total_reworks || 0, total_complaints || 0, total_deduction || 0, final_amount || 0, status || 'draft'], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...data });
      });
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM settlements WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM settlements WHERE 1=1';
      const params = [];

      if (filters.cleaner_name) {
        sql += ' AND cleaner_name LIKE ?';
        params.push(`%${filters.cleaner_name}%`);
      }
      if (filters.settlement_month) {
        sql += ' AND settlement_month = ?';
        params.push(filters.settlement_month);
      }
      if (filters.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
      }

      sql += ' ORDER BY settlement_month DESC, created_at DESC';

      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static update(id, data) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const values = [];
      
      Object.keys(data).forEach(key => {
        if (key !== 'id' && key !== 'created_at') {
          fields.push(`${key} = ?`);
          values.push(data[key]);
        }
      });
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const sql = `UPDATE settlements SET ${fields.join(', ')} WHERE id = ?`;
      db.run(sql, values, function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }

  static approve(id, reviewed_by) {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE settlements 
        SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`;
      db.run(sql, [reviewed_by, id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }

  static generateByMonth(settlement_month, cleaner_name) {
    return new Promise((resolve, reject) => {
      const startDate = `${settlement_month}-01`;
      const endDate = `${settlement_month}-31`;

      db.get(`SELECT COUNT(*) as total_cleanings FROM cleaning_records 
        WHERE cleaner_name = ? AND check_date >= ? AND check_date <= ? AND status = 'approved'`,
        [cleaner_name, startDate, endDate], (err, cleaningResult) => {
          if (err) { reject(err); return; }

          db.get(`SELECT COUNT(*) as total_reworks, SUM(deduction_amount) as rework_deduction 
            FROM reworks WHERE original_cleaner = ? AND rework_date >= ? AND rework_date <= ? AND status = 'completed'`,
            [cleaner_name, startDate, endDate], (err, reworkResult) => {
              if (err) { reject(err); return; }

              db.get(`SELECT COUNT(*) as total_complaints, SUM(deduction_amount) as complaint_deduction 
                FROM complaints WHERE handler_name = ? AND occurred_at >= ? AND occurred_at <= ? AND status = 'resolved'`,
                [cleaner_name, startDate, endDate], (err, complaintResult) => {
                  if (err) { reject(err); return; }

                  const total_cleanings = cleaningResult.total_cleanings || 0;
                  const total_reworks = reworkResult.total_reworks || 0;
                  const total_complaints = complaintResult.total_complaints || 0;
                  const rework_deduction = reworkResult.rework_deduction || 0;
                  const complaint_deduction = complaintResult.complaint_deduction || 0;
                  const total_deduction = parseFloat(rework_deduction) + parseFloat(complaint_deduction);
                  const base_amount = total_cleanings * 50;
                  const final_amount = Math.max(0, base_amount - total_deduction);

                  resolve({
                    settlement_month,
                    cleaner_name,
                    total_cleanings,
                    total_reworks,
                    total_complaints,
                    total_deduction,
                    final_amount,
                    base_amount
                  });
                });
            });
        });
    });
  }
}

module.exports = Settlement;