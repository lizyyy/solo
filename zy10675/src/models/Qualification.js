const { db, STATUS, SOURCE_TYPES } = require('../database');
const crypto = require('crypto');

class Qualification {
  static generateId() {
    return 'QUAL_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
  }

  static create(data) {
    return new Promise((resolve, reject) => {
      const qualificationId = this.generateId();
      const { member_id, activity_id, source_type, reason, operator_id, operator_name } = data;
      
      db.get(
        `SELECT * FROM members WHERE member_id = ?`,
        [member_id],
        (err, member) => {
          if (err) return reject(err);
          
          db.run(
            `INSERT INTO qualifications (qualification_id, member_id, activity_id, source_type, reason, status, operator_id, operator_name)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [qualificationId, member_id, activity_id, source_type, reason, STATUS.PENDING_REVIEW, operator_id, operator_name],
            function(err) {
              if (err) return reject(err);
              
              db.run(
                `INSERT INTO audit_logs (qualification_id, action, old_status, new_status, operator_id, operator_name, remark)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [qualificationId, '创建', null, STATUS.PENDING_REVIEW, operator_id, operator_name, reason],
                (auditErr) => {
                  if (auditErr) return reject(auditErr);
                  resolve({ id: qualificationId, ...data, status: STATUS.PENDING_REVIEW });
                }
              );
            }
          );
        }
      );
    });
  }

  static update(qualificationId, data) {
    return new Promise((resolve, reject) => {
      const { reason, operator_id, operator_name } = data;
      
      db.get(
        `SELECT * FROM qualifications WHERE qualification_id = ?`,
        [qualificationId],
        (err, oldQual) => {
          if (err) return reject(err);
          if (!oldQual) return reject(new Error('资格记录不存在'));

          db.run(
            `UPDATE qualifications SET reason = ?, updated_at = CURRENT_TIMESTAMP WHERE qualification_id = ?`,
            [reason, qualificationId],
            function(err) {
              if (err) return reject(err);
              
              db.run(
                `INSERT INTO audit_logs (qualification_id, action, old_status, new_status, operator_id, operator_name, remark)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [qualificationId, '修改', oldQual.status, oldQual.status, operator_id, operator_name, reason],
                (auditErr) => {
                  if (auditErr) return reject(auditErr);
                  resolve({ success: true });
                }
              );
            }
          );
        }
      );
    });
  }

  static review(qualificationId, approved, remark, operator_id, operator_name) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM qualifications WHERE qualification_id = ?`,
        [qualificationId],
        (err, oldQual) => {
          if (err) return reject(err);
          if (!oldQual) return reject(new Error('资格记录不存在'));
          if (oldQual.status !== STATUS.PENDING_REVIEW) {
            return reject(new Error('当前状态不允许审核'));
          }

          const newStatus = approved ? STATUS.OBTAINED : STATUS.NOT_OBTAINED;
          
          db.run(
            `UPDATE qualifications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE qualification_id = ?`,
            [newStatus, qualificationId],
            function(err) {
              if (err) return reject(err);
              
              db.run(
                `INSERT INTO audit_logs (qualification_id, action, old_status, new_status, operator_id, operator_name, remark)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [qualificationId, approved ? '审核通过' : '审核驳回', oldQual.status, newStatus, operator_id, operator_name, remark],
                (auditErr) => {
                  if (auditErr) return reject(auditErr);
                  resolve({ success: true, status: newStatus });
                }
              );
            }
          );
        }
      );
    });
  }

  static revoke(qualificationId, reason, operator_id, operator_name) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM qualifications WHERE qualification_id = ?`,
        [qualificationId],
        (err, oldQual) => {
          if (err) return reject(err);
          if (!oldQual) return reject(new Error('资格记录不存在'));
          if (oldQual.status !== STATUS.OBTAINED) {
            return reject(new Error('只有已获得状态可以撤销'));
          }

          db.run(
            `UPDATE qualifications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE qualification_id = ?`,
            [STATUS.REVOKED, qualificationId],
            function(err) {
              if (err) return reject(err);
              
              db.run(
                `INSERT INTO audit_logs (qualification_id, action, old_status, new_status, operator_id, operator_name, remark)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [qualificationId, '撤销', oldQual.status, STATUS.REVOKED, operator_id, operator_name, reason],
                (auditErr) => {
                  if (auditErr) return reject(auditErr);
                  resolve({ success: true, status: STATUS.REVOKED });
                }
              );
            }
          );
        }
      );
    });
  }

  static list(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT q.*, m.member_name, m.group_name, a.activity_name, m.is_in_group
        FROM qualifications q
        LEFT JOIN members m ON q.member_id = m.member_id
        LEFT JOIN activities a ON q.activity_id = a.activity_id
        WHERE 1=1
      `;
      const params = [];

      if (filters.member_id) {
        sql += ` AND q.member_id = ?`;
        params.push(filters.member_id);
      }
      if (filters.activity_id) {
        sql += ` AND q.activity_id = ?`;
        params.push(filters.activity_id);
      }
      if (filters.status) {
        sql += ` AND q.status = ?`;
        params.push(filters.status);
      }

      sql += ` ORDER BY q.created_at DESC`;

      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static getDetail(qualificationId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT q.*, m.member_name, m.group_name, a.activity_name, m.is_in_group
         FROM qualifications q
         LEFT JOIN members m ON q.member_id = m.member_id
         LEFT JOIN activities a ON q.activity_id = a.activity_id
         WHERE q.qualification_id = ?`,
        [qualificationId],
        (err, qualification) => {
          if (err) return reject(err);
          if (!qualification) return resolve(null);

          db.all(
            `SELECT * FROM audit_logs WHERE qualification_id = ? ORDER BY created_at DESC`,
            [qualificationId],
            (err, logs) => {
              if (err) return reject(err);
              resolve({ ...qualification, audit_logs: logs });
            }
          );
        }
      );
    });
  }

  static export(filters = {}) {
    return this.list(filters);
  }

  static checkConflict(member_id, activity_id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM qualifications 
         WHERE member_id = ? AND activity_id = ? AND status IN (?, ?)`,
        [member_id, activity_id, STATUS.PENDING_REVIEW, STATUS.OBTAINED],
        (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        }
      );
    });
  }
}

module.exports = { Qualification, STATUS, SOURCE_TYPES };
