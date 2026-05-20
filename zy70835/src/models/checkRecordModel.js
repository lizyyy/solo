const db = require('../config/database');

class CheckRecordModel {
  static create(recordData) {
    return new Promise((resolve, reject) => {
      const {
        batch_id, student_id, student_name, class_name,
        temperature, has_medication, medication_details,
        parent_confirmed, parent_name, parent_phone, handler,
        status, abnormal_type
      } = recordData;
      
      db.run(
        `INSERT INTO check_records 
         (batch_id, student_id, student_name, class_name, temperature, 
          has_medication, medication_details, parent_confirmed, parent_name, parent_phone, 
          handler, last_handler, status, abnormal_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [batch_id, student_id, student_name, class_name, temperature,
         has_medication, medication_details, parent_confirmed, parent_name, parent_phone,
         handler, handler, status, abnormal_type],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...recordData });
        }
      );
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM check_records WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static findByBatch(batch_id) {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM check_records WHERE batch_id = ? ORDER BY created_at DESC`, [batch_id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static updateStatus(id, status, abnormal_type, operator, reason) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.get(`SELECT status, abnormal_type FROM check_records WHERE id = ?`, [id], (err, oldRecord) => {
          if (err) {
            reject(err);
            return;
          }

          db.run(
            `UPDATE check_records SET status = ?, abnormal_type = ?, last_handler = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [status, abnormal_type, operator, id],
            function(err) {
              if (err) {
                reject(err);
                return;
              }

              db.run(
                `INSERT INTO processing_trails 
                 (record_id, action_type, old_status, new_status, old_abnormal_type, new_abnormal_type, reason, operator)
                 VALUES (?, 'status_change', ?, ?, ?, ?, ?, ?)`,
                [id, oldRecord.status, status, oldRecord.abnormal_type, abnormal_type, reason, operator],
                function(trailErr) {
                  if (trailErr) reject(trailErr);
                  else resolve({ changes: this.changes });
                }
              );
            }
          );
        });
      });
    });
  }

  static updateFollowUp(id, follow_up_status, follow_up_remark, operator) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE check_records SET follow_up_status = ?, follow_up_remark = ?, last_handler = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [follow_up_status, follow_up_remark, operator, id],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  }

  static getTrails(record_id) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM processing_trails WHERE record_id = ? ORDER BY created_at DESC`,
        [record_id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static getChangeHistory(record_id) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM change_history WHERE record_id = ? ORDER BY created_at DESC`,
        [record_id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static addChangeHistory(record_id, field_name, old_value, new_value, change_reason, operator) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO change_history (record_id, field_name, old_value, new_value, change_reason, operator)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [record_id, field_name, old_value, new_value, change_reason, operator],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });
  }

  static findByClass(class_name) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM check_records WHERE class_name = ? AND status != 'normal' ORDER BY created_at DESC`,
        [class_name],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static exportByDate(check_date) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT cr.*, b.batch_no, b.check_date 
         FROM check_records cr 
         JOIN batches b ON cr.batch_id = b.id 
         WHERE b.check_date = ? 
         ORDER BY cr.class_name, cr.student_name`,
        [check_date],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static getStatistics(check_date) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT 
          COUNT(*) as total,
          COALESCE(SUM(CASE WHEN cr.status = 'normal' THEN 1 ELSE 0 END), 0) as normal,
          COALESCE(SUM(CASE WHEN cr.status = 'pending' THEN 1 ELSE 0 END), 0) as pending,
          COALESCE(SUM(CASE WHEN cr.status = 'blocked' THEN 1 ELSE 0 END), 0) as blocked,
          COALESCE(SUM(CASE WHEN cr.abnormal_type = 'fever_quarantine' THEN 1 ELSE 0 END), 0) as fever_quarantine,
          COALESCE(SUM(CASE WHEN cr.abnormal_type = 'medication_auth' THEN 1 ELSE 0 END), 0) as medication_auth,
          COALESCE(SUM(CASE WHEN cr.abnormal_type = 'parent_unconfirmed' THEN 1 ELSE 0 END), 0) as parent_unconfirmed
         FROM check_records cr
         JOIN batches b ON cr.batch_id = b.id
         WHERE b.check_date = ?`,
        [check_date],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row || {
              total: 0, normal: 0, pending: 0, blocked: 0,
              fever_quarantine: 0, medication_auth: 0, parent_unconfirmed: 0
            });
          }
        }
      );
    });
  }
}

module.exports = CheckRecordModel;