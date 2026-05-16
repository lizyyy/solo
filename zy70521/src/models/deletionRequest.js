const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { DELETION_STATUS, VALID_STATUS_TRANSITIONS } = require('../constants/status');

class DeletionRequest {
  static async create(data) {
    const id = uuidv4();
    const now = new Date().toISOString();
    const graceDeadline = new Date(Date.now() + (data.grace_period_hours || 72) * 60 * 60 * 1000).toISOString();
    
    const sql = `
      INSERT INTO deletion_requests (
        id, user_subject, deletion_scope, scope_details, grace_period_hours,
        grace_deadline, status, created_at, created_by, reason, original_request,
        processing_evidence, final_conclusion, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const originalRequest = JSON.stringify(data);
    const params = [
      id, data.user_subject, data.deletion_scope, JSON.stringify(data.scope_details || {}),
      data.grace_period_hours || 72, graceDeadline, DELETION_STATUS.PENDING,
      now, data.created_by, data.reason, originalRequest, null, null, 1
    ];

    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id, ...data, status: DELETION_STATUS.PENDING, created_at: now, grace_deadline: graceDeadline });
      });
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM deletion_requests WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row ? this.parseRow(row) : null);
      });
    });
  }

  static async findAll(filters = {}) {
    let sql = 'SELECT * FROM deletion_requests WHERE 1=1';
    const params = [];

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.user_subject) {
      sql += ' AND user_subject = ?';
      params.push(filters.user_subject);
    }

    sql += ' ORDER BY created_at DESC';

    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => this.parseRow(row)));
      });
    });
  }

  static async updateStatus(id, newStatus, changedBy, reason, evidence = null) {
    const request = await this.findById(id);
    if (!request) {
      throw new Error('DELETION_REQUEST_NOT_FOUND');
    }

    const validTransitions = VALID_STATUS_TRANSITIONS[request.status] || [];
    if (!validTransitions.includes(newStatus)) {
      throw new Error(`INVALID_STATUS_TRANSITION: ${request.status} -> ${newStatus}`);
    }

    const now = new Date().toISOString();
    const historyId = uuidv4();

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(
          'UPDATE deletion_requests SET status = ?, version = version + 1 WHERE id = ?',
          [newStatus, id],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
          }
        );

        db.run(
          `INSERT INTO status_history (id, deletion_request_id, old_status, new_status, changed_at, changed_by, reason, evidence)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [historyId, id, request.status, newStatus, now, changedBy, reason, evidence ? JSON.stringify(evidence) : null],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
          }
        );

        db.run('COMMIT', (err) => {
          if (err) reject(err);
          else resolve({ id, old_status: request.status, new_status: newStatus, changed_at: now });
        });
      });
    });
  }

  static async manualCorrect(id, updates, correctedBy, reason) {
    const request = await this.findById(id);
    if (!request) {
      throw new Error('DELETION_REQUEST_NOT_FOUND');
    }

    const allowedFields = ['user_subject', 'deletion_scope', 'scope_details', 'grace_period_hours', 'grace_deadline', 'reason'];
    const updateFields = [];
    const params = [];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        params.push(field === 'scope_details' ? JSON.stringify(updates[field]) : updates[field]);
      }
    }

    if (updateFields.length === 0) {
      throw new Error('NO_VALID_FIELDS_TO_UPDATE');
    }

    updateFields.push('version = version + 1');
    params.push(id);

    const now = new Date().toISOString();
    const historyId = uuidv4();

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(
          `UPDATE deletion_requests SET ${updateFields.join(', ')} WHERE id = ?`,
          params,
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
          }
        );

        db.run(
          `INSERT INTO status_history (id, deletion_request_id, old_status, new_status, changed_at, changed_by, reason, evidence)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [historyId, id, request.status, request.status, now, correctedBy, reason, JSON.stringify({ manual_correction: updates })],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
          }
        );

        db.run('COMMIT', async (err) => {
          if (err) reject(err);
          else resolve(await DeletionRequest.findById(id));
        });
      });
    });
  }

  static async getStatusHistory(id) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM status_history WHERE deletion_request_id = ? ORDER BY changed_at DESC',
        [id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => ({
            ...row,
            evidence: row.evidence ? JSON.parse(row.evidence) : null
          })));
        }
      );
    });
  }

  static parseRow(row) {
    return {
      ...row,
      scope_details: row.scope_details ? JSON.parse(row.scope_details) : null,
      processing_evidence: row.processing_evidence ? JSON.parse(row.processing_evidence) : null,
      final_conclusion: row.final_conclusion ? JSON.parse(row.final_conclusion) : null
    };
  }

  static generateHash(content) {
    return crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
  }
}

module.exports = DeletionRequest;
