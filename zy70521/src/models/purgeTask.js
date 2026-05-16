const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const { PURGE_TASK_STATUS, DELETION_STATUS } = require('../constants/status');
const DeletionRequest = require('./deletionRequest');

class PurgeTask {
  static async create(deletionRequestId, purgeScope) {
    const deletionRequest = await DeletionRequest.findById(deletionRequestId);
    if (!deletionRequest) {
      throw new Error('DELETION_REQUEST_NOT_FOUND');
    }

    const validStates = [DELETION_STATUS.IN_GRACE_PERIOD, DELETION_STATUS.PURGE_SCHEDULED];
    if (!validStates.includes(deletionRequest.status)) {
      throw new Error('PURGE_NOT_ALLOWED: 状态不允许创建清除任务');
    }

    const existingTasks = await this.findByDeletionRequestId(deletionRequestId);
    const activeTask = existingTasks.find(t => 
      [PURGE_TASK_STATUS.SCHEDULED, PURGE_TASK_STATUS.IN_PROGRESS, PURGE_TASK_STATUS.COMPLETED].includes(t.status)
    );

    if (activeTask && activeTask.status === PURGE_TASK_STATUS.COMPLETED) {
      throw new Error('PURGE_ALREADY_COMPLETED: 清除任务已完成，幂等性保护');
    }

    if (activeTask && [PURGE_TASK_STATUS.SCHEDULED, PURGE_TASK_STATUS.IN_PROGRESS].includes(activeTask.status)) {
      return activeTask;
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const scheduledAt = new Date(deletionRequest.grace_deadline).toISOString();

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(
          `INSERT INTO purge_tasks (
            id, deletion_request_id, scheduled_at, status, purge_scope, retry_count
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [id, deletionRequestId, scheduledAt, PURGE_TASK_STATUS.SCHEDULED, JSON.stringify(purgeScope), 0],
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
          [DELETION_STATUS.PURGE_SCHEDULED, deletionRequestId],
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
            DELETION_STATUS.PURGE_SCHEDULED, 
            now, 
            'SYSTEM', 
            '创建清除任务',
            JSON.stringify({ purge_task_id: id, purge_scope: purgeScope })
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
            scheduled_at: scheduledAt,
            status: PURGE_TASK_STATUS.SCHEDULED,
            purge_scope: purgeScope
          });
        });
      });
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM purge_tasks WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row ? this.parseRow(row) : null);
      });
    });
  }

  static async findByDeletionRequestId(deletionRequestId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM purge_tasks WHERE deletion_request_id = ? ORDER BY scheduled_at DESC',
        [deletionRequestId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => this.parseRow(row)));
        }
      );
    });
  }

  static async start(id) {
    const task = await this.findById(id);
    if (!task) {
      throw new Error('PURGE_TASK_NOT_FOUND');
    }

    if (task.status !== PURGE_TASK_STATUS.SCHEDULED) {
      throw new Error('TASK_NOT_SCHEDULED');
    }

    const deletionRequest = await DeletionRequest.findById(task.deletion_request_id);
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(
          'UPDATE purge_tasks SET status = ?, started_at = ? WHERE id = ?',
          [PURGE_TASK_STATUS.IN_PROGRESS, now, id],
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
          [DELETION_STATUS.PURGE_IN_PROGRESS, task.deletion_request_id],
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
            task.deletion_request_id, 
            deletionRequest.status, 
            DELETION_STATUS.PURGE_IN_PROGRESS, 
            now, 
            'SYSTEM', 
            '开始执行清除任务',
            JSON.stringify({ purge_task_id: id, started_at: now })
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
          else resolve({ id, status: PURGE_TASK_STATUS.IN_PROGRESS, started_at: now });
        });
      });
    });
  }

  static async complete(id, recordsPurged, bytesPurged, executionLog) {
    const task = await this.findById(id);
    if (!task) {
      throw new Error('PURGE_TASK_NOT_FOUND');
    }

    if (task.status !== PURGE_TASK_STATUS.IN_PROGRESS) {
      throw new Error('TASK_NOT_IN_PROGRESS');
    }

    const deletionRequest = await DeletionRequest.findById(task.deletion_request_id);
    const now = new Date().toISOString();
    const evidenceHash = DeletionRequest.generateHash({
      records_purged: recordsPurged,
      bytes_purged: bytesPurged,
      completed_at: now
    });

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(
          `UPDATE purge_tasks 
           SET status = ?, completed_at = ?, records_purged = ?, bytes_purged = ?, 
               execution_log = ?, evidence_hash = ?
           WHERE id = ?`,
          [PURGE_TASK_STATUS.COMPLETED, now, recordsPurged, bytesPurged, JSON.stringify(executionLog), evidenceHash, id],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
          }
        );

        db.run(
          `UPDATE deletion_requests 
           SET status = ?, processing_evidence = ?, final_conclusion = ?, version = version + 1 
           WHERE id = ?`,
          [
            DELETION_STATUS.PURGED,
            JSON.stringify({ purge_completed: now, evidence_hash: evidenceHash }),
            JSON.stringify({ conclusion: 'PURGED_SUCCESSFULLY', records_purged: recordsPurged }),
            task.deletion_request_id
          ],
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
            task.deletion_request_id, 
            deletionRequest.status, 
            DELETION_STATUS.PURGED, 
            now, 
            'SYSTEM', 
            '清除任务完成',
            JSON.stringify({ 
              purge_task_id: id, 
              records_purged: recordsPurged,
              bytes_purged: bytesPurged,
              evidence_hash: evidenceHash 
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
            status: PURGE_TASK_STATUS.COMPLETED,
            completed_at: now,
            records_purged: recordsPurged,
            bytes_purged: bytesPurged,
            evidence_hash: evidenceHash
          });
        });
      });
    });
  }

  static async fail(id, errorDetails) {
    const task = await this.findById(id);
    if (!task) {
      throw new Error('PURGE_TASK_NOT_FOUND');
    }

    const deletionRequest = await DeletionRequest.findById(task.deletion_request_id);
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(
          `UPDATE purge_tasks 
           SET status = ?, error_details = ?, retry_count = retry_count + 1
           WHERE id = ?`,
          [PURGE_TASK_STATUS.FAILED, JSON.stringify(errorDetails), id],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
          }
        );

        db.run(
          `UPDATE deletion_requests 
           SET status = ?, processing_evidence = ?, final_conclusion = ?, version = version + 1 
           WHERE id = ?`,
          [
            DELETION_STATUS.ERROR,
            JSON.stringify({ 
              purge_failed: now, 
              error_details: errorDetails 
            }),
            JSON.stringify({ 
              conclusion: 'PURGE_FAILED', 
              error_code: errorDetails.code || 'UNKNOWN',
              error_message: errorDetails.message || '未知错误'
            }),
            task.deletion_request_id
          ],
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
            task.deletion_request_id, 
            deletionRequest.status, 
            DELETION_STATUS.ERROR, 
            now, 
            'SYSTEM', 
            '清除任务失败',
            JSON.stringify({ 
              purge_task_id: id, 
              failed_at: now,
              error_details: errorDetails 
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
            status: PURGE_TASK_STATUS.FAILED,
            error_details: errorDetails,
            failed_at: now
          });
        });
      });
    });
  }

  static parseRow(row) {
    return {
      ...row,
      purge_scope: row.purge_scope ? JSON.parse(row.purge_scope) : null,
      error_details: row.error_details ? JSON.parse(row.error_details) : null,
      execution_log: row.execution_log ? JSON.parse(row.execution_log) : null
    };
  }
}

module.exports = PurgeTask;
