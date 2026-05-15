const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class AppealModel {
  static createAppeal(data) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { contentId, submitterId, submitterName, submitterContact, appealReason, evidenceMaterials } = data;
      
      db.run(
        `INSERT INTO appeals (id, content_id, submitter_id, submitter_name, submitter_contact, appeal_reason, evidence_materials)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, contentId, submitterId, submitterName, submitterContact, appealReason, evidenceMaterials],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...data });
        }
      );
    });
  }

  static getAppealById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM appeals WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static getAppeals(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT a.*, c.content_type, c.content_text, c.author_name, c.block_time, c.content_status
        FROM appeals a
        LEFT JOIN content_items c ON a.content_id = c.id
        WHERE 1=1
      `;
      const params = [];

      if (filters.status) {
        query += ` AND a.status = ?`;
        params.push(filters.status);
      }
      if (filters.assigneeId) {
        query += ` AND a.assignee_id = ?`;
        params.push(filters.assigneeId);
      }
      if (filters.submitterName) {
        query += ` AND a.submitter_name LIKE ?`;
        params.push(`%${filters.submitterName}%`);
      }

      query += ` ORDER BY a.created_at DESC`;

      if (filters.limit) {
        query += ` LIMIT ?`;
        params.push(filters.limit);
      }
      if (filters.offset) {
        query += ` OFFSET ?`;
        params.push(filters.offset);
      }

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static updateAppealStatus(id, status, assigneeId = null, assigneeName = null) {
    return new Promise((resolve, reject) => {
      let query = `UPDATE appeals SET status = ?, updated_at = CURRENT_TIMESTAMP`;
      const params = [status];

      if (assigneeId) {
        query += `, assignee_id = ?, assignee_name = ?`;
        params.push(assigneeId, assigneeName);
      }

      query += ` WHERE id = ?`;
      params.push(id);

      db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  static updateDisposal(id, disposalType, disposalNote) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE appeals SET disposal_type = ?, disposal_note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [disposalType, disposalNote, id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  static addAuditTrail(appealId, action, operatorId, operatorName, remark, oldStatus, newStatus) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO audit_trail (appeal_id, action, operator_id, operator_name, remark, old_status, new_status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [appealId, action, operatorId, operatorName, remark, oldStatus, newStatus],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  static getAuditTrail(appealId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM audit_trail WHERE appeal_id = ? ORDER BY created_at ASC`,
        [appealId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
}

module.exports = AppealModel;
