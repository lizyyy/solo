const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const { REVOCATION_STATUS, DELETION_STATUS } = require('../constants/status');
const DeletionRequest = require('./deletionRequest');

class RevocationRequest {
  static async create(deletionRequestId, data) {
    const deletionRequest = await DeletionRequest.findById(deletionRequestId);
    if (!deletionRequest) {
      throw new Error('DELETION_REQUEST_NOT_FOUND');
    }

    if (deletionRequest.status !== DELETION_STATUS.IN_GRACE_PERIOD) {
      throw new Error('REVOCATION_NOT_ALLOWED: 仅宽限期内可申请撤销');
    }

    const now = new Date();
    const graceDeadline = new Date(deletionRequest.grace_deadline);
    
    if (now > graceDeadline) {
      throw new Error('REVOCATION_NOT_ALLOWED: 宽限期已过');
    }

    const id = uuidv4();

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(
          `INSERT INTO revocation_requests (
            id, deletion_request_id, requested_at, requested_by, reason, status
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [id, deletionRequestId, now.toISOString(), data.requested_by, data.reason, REVOCATION_STATUS.PENDING],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
          }
        );

        db.run(
          'UPDATE deletion_requests SET status = ?, version = version + 1 WHERE id = ?',
          [DELETION_STATUS.REVOCATION_REQUESTED, deletionRequestId],
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
          [
            uuidv4(), 
            deletionRequestId, 
            deletionRequest.status, 
            DELETION_STATUS.REVOCATION_REQUESTED, 
            now.toISOString(), 
            data.requested_by, 
            data.reason,
            JSON.stringify({ revocation_request_id: id })
          ],
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
          else resolve({
            id,
            deletion_request_id: deletionRequestId,
            requested_at: now.toISOString(),
            requested_by: data.requested_by,
            reason: data.reason,
            status: REVOCATION_STATUS.PENDING
          });
        });
      });
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM revocation_requests WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async findByDeletionRequestId(deletionRequestId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM revocation_requests WHERE deletion_request_id = ? ORDER BY requested_at DESC',
        [deletionRequestId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async review(id, decision, reviewedBy, reviewNotes = null) {
    const revocation = await this.findById(id);
    if (!revocation) {
      throw new Error('REVOCATION_NOT_FOUND');
    }

    if (revocation.status !== REVOCATION_STATUS.PENDING) {
      throw new Error('REVOCATION_ALREADY_REVIEWED');
    }

    const deletionRequest = await DeletionRequest.findById(revocation.deletion_request_id);
    const now = new Date().toISOString();
    const newStatus = decision === 'APPROVE' ? REVOCATION_STATUS.APPROVED : REVOCATION_STATUS.REJECTED;
    const deletionStatus = decision === 'APPROVE' ? DELETION_STATUS.REVOKED : DELETION_STATUS.IN_GRACE_PERIOD;

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(
          `UPDATE revocation_requests 
           SET status = ?, reviewed_by = ?, reviewed_at = ?, review_notes = ?, evidence = ?
           WHERE id = ?`,
          [newStatus, reviewedBy, now, reviewNotes, JSON.stringify({ decision, reviewed_by: reviewedBy, reviewed_at: now }), id],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
          }
        );

        db.run(
          'UPDATE deletion_requests SET status = ?, version = version + 1 WHERE id = ?',
          [deletionStatus, revocation.deletion_request_id],
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
          [
            uuidv4(), 
            revocation.deletion_request_id, 
            deletionRequest.status, 
            deletionStatus, 
            now, 
            reviewedBy, 
            `撤销审核${decision === 'APPROVE' ? '通过' : '拒绝'}`,
            JSON.stringify({ 
              revocation_request_id: id, 
              decision, 
              review_notes: reviewNotes 
            })
          ],
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
          else resolve({
            id,
            status: newStatus,
            decision,
            reviewed_by: reviewedBy,
            reviewed_at: now
          });
        });
      });
    });
  }
}

module.exports = RevocationRequest;
