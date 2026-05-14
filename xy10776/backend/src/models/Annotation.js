const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const STATUS_TRANSITIONS = {
  draft: ['pending_approval', 'cancelled'],
  pending_approval: ['approved', 'rejected', 'draft'],
  approved: ['published', 'revoked'],
  published: ['archived', 'recalled'],
  rejected: ['draft', 'cancelled', 'correction_pending'],
  revoked: ['draft', 'cancelled'],
  archived: [],
  cancelled: [],
  recalled: ['draft'],
  correction_pending: ['pending_approval', 'cancelled']
};

const VALID_STATUSES = Object.keys(STATUS_TRANSITIONS);

class AnnotationModel {
  static canTransition(currentStatus, nextStatus) {
    return STATUS_TRANSITIONS[currentStatus]?.includes(nextStatus) || false;
  }

  static async create(data) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const requestId = data.request_id || uuidv4();
      
      db.get('SELECT id FROM annotation_events WHERE request_id = ?', [requestId], (err, row) => {
        if (err) return reject(err);
        if (row) {
          return this.getById(row.id).then(resolve).catch(reject);
        }

        const sql = `
          INSERT INTO annotation_events 
          (id, request_id, title, description, event_type, event_date, impact_level, created_by, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')
        `;

        db.run(sql, [
          id, requestId, data.title, data.description, data.event_type, 
          data.event_date, data.impact_level || 'medium', data.created_by
        ], function(err) {
          if (err) return reject(err);
          
          if (data.scopes && data.scopes.length > 0) {
            const scopeStmt = db.prepare(`
              INSERT INTO scope_definitions (id, annotation_id, scope_type, scope_value)
              VALUES (?, ?, ?, ?)
            `);
            data.scopes.forEach(scope => {
              scopeStmt.run(uuidv4(), id, scope.scope_type, scope.scope_value);
            });
            scopeStmt.finalize();
          }

          this.createVersion(id, 1, data.created_by).then(() => {
            this.getById(id).then(resolve).catch(reject);
          }).catch(reject);
        });
      });
    });
  }

  static async createVersion(annotationId, versionNumber, createdBy) {
    return new Promise((resolve, reject) => {
      this.getById(annotationId).then(annotation => {
        const versionId = uuidv4();
        const sql = `
          INSERT INTO versions (id, annotation_id, version_number, snapshot_data, created_by)
          VALUES (?, ?, ?, ?, ?)
        `;
        db.run(sql, [versionId, annotationId, versionNumber, JSON.stringify(annotation), createdBy], (err) => {
          if (err) return reject(err);
          resolve(versionId);
        });
      }).catch(reject);
    });
  }

  static async getById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM annotation_events WHERE id = ?', [id], (err, annotation) => {
        if (err) return reject(err);
        if (!annotation) return resolve(null);
        
        db.all('SELECT * FROM scope_definitions WHERE annotation_id = ?', [id], (err, scopes) => {
          if (err) return reject(err);
          annotation.scopes = scopes;
          
          db.all('SELECT * FROM approval_status_logs WHERE annotation_id = ? ORDER BY created_at DESC', [id], (err, logs) => {
            if (err) return reject(err);
            annotation.approval_logs = logs;
            resolve(annotation);
          });
        });
      });
    });
  }

  static async transitionStatus(id, newStatus, approver, comment, updatedBy) {
    return new Promise((resolve, reject) => {
      db.get('SELECT status, version, retry_count, max_retries FROM annotation_events WHERE id = ?', [id], async (err, current) => {
        if (err) return reject(err);
        if (!current) return reject(new Error('注释事件不存在'));

        if (!this.canTransition(current.status, newStatus)) {
          return reject(new Error(`不允许从 ${current.status} 转换到 ${newStatus}`));
        }

        if (newStatus === 'correction_pending' && current.retry_count >= current.max_retries) {
          return reject(new Error('已达到最大重试次数，无法进入修正流程'));
        }

        const newVersion = current.version + 1;
        const newRetryCount = newStatus === 'correction_pending' ? current.retry_count + 1 : current.retry_count;

        db.run(`
          UPDATE annotation_events 
          SET status = ?, version = ?, retry_count = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [newStatus, newVersion, newRetryCount, id], async (err) => {
          if (err) return reject(err);

          const logId = uuidv4();
          db.run(`
            INSERT INTO approval_status_logs (id, annotation_id, status, approver, comment)
            VALUES (?, ?, ?, ?, ?)
          `, [logId, id, newStatus, approver, comment], async (err) => {
            if (err) return reject(err);

            await this.createVersion(id, newVersion, updatedBy);
            await this.triggerRecalculation(id, updatedBy);
            
            this.getById(id).then(resolve).catch(reject);
          });
        });
      });
    });
  }

  static async triggerRecalculation(annotationId, recalculatedBy) {
    return new Promise((resolve, reject) => {
      const recordId = uuidv4();
      db.get('SELECT * FROM chart_metrics LIMIT 10', [], (err, metrics) => {
        const affectedMetrics = JSON.stringify(metrics ? metrics.map(m => m.metric_name) : []);
        db.run(`
          INSERT INTO timeline_recalculation_records (id, annotation_id, recalculated_by, affected_metrics, notes)
          VALUES (?, ?, ?, ?, '状态变更触发重新计算')
        `, [recordId, annotationId, recalculatedBy, affectedMetrics], (err) => {
          if (err) return reject(err);
          resolve(recordId);
        });
      });
    });
  }

  static async list(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM annotation_events WHERE 1=1';
      const params = [];

      if (filters.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.event_type) {
        sql += ' AND event_type = ?';
        params.push(filters.event_type);
      }
      if (filters.start_date) {
        sql += ' AND event_date >= ?';
        params.push(filters.start_date);
      }
      if (filters.end_date) {
        sql += ' AND event_date <= ?';
        params.push(filters.end_date);
      }

      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(filters.limit || 20, filters.offset || 0);

      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  static async replayVersion(annotationId, versionNumber, replayedBy) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT * FROM versions 
        WHERE annotation_id = ? AND version_number = ?
      `, [annotationId, versionNumber], (err, version) => {
        if (err) return reject(err);
        if (!version) return reject(new Error('版本不存在'));

        const snapshot = JSON.parse(version.snapshot_data);
        resolve({
          version: version.version_number,
          snapshot,
          replayed_by: replayedBy,
          replayed_at: new Date().toISOString(),
          can_restore: snapshot.status === 'published' || snapshot.status === 'approved'
        });
      });
    });
  }
}

module.exports = AnnotationModel;
