const db = require('../database');
const moment = require('moment');

class DegradeService {
  async createDegrade(data) {
    return new Promise((resolve, reject) => {
      const { cache_key, business_line, degrade_reason, executor } = data;
      
      db.get(`SELECT id FROM degrade_records WHERE cache_key = ? AND status IN ('degraded', 'restore_applied')`, 
        [cache_key], 
        (err, row) => {
          if (err) return reject(err);
          if (row) return reject(new Error('该Key已处于降级或恢复申请状态'));

          db.run(`INSERT INTO degrade_records (cache_key, business_line, degrade_reason, executor, status)
                  VALUES (?, ?, ?, ?, 'degraded')`,
            [cache_key, business_line, degrade_reason, executor],
            function(err) {
              if (err) return reject(err);
              resolve({ id: this.lastID, ...data, status: 'degraded' });
            }
          );
        }
      );
    });
  }

  async applyRestore(id, applicant) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM degrade_records WHERE id = ?`, [id], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('降级记录不存在'));
        if (row.status !== 'degraded') return reject(new Error('当前状态不允许申请恢复'));

        db.run(`UPDATE degrade_records 
                SET status = 'restore_applied', 
                    restore_applicant = ?, 
                    restore_time = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
          [applicant, moment().format('YYYY-MM-DD HH:mm:ss'), id],
          function(err) {
            if (err) return reject(err);
            resolve({ id, status: 'restore_applied', applicant });
          }
        );
      });
    });
  }

  async confirmCleanup(taskId, operator) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM cleanup_tasks WHERE id = ?`, [taskId], (err, task) => {
        if (err) return reject(err);
        if (!task) return reject(new Error('清理任务不存在'));
        if (task.status !== 'pending') return reject(new Error('任务状态不允许确认'));

        db.serialize(() => {
          db.run(`UPDATE cleanup_tasks 
                  SET status = 'confirmed', 
                      confirmed_at = CURRENT_TIMESTAMP,
                      confirmed_by = ?
                  WHERE id = ?`,
            [operator, taskId]
          );

          db.run(`UPDATE degrade_records 
                  SET status = 'completed',
                      updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?`,
            [task.degrade_record_id]
          );

          resolve({ taskId, status: 'confirmed', operator });
        });
      });
    });
  }

  async queryRecords(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT * FROM degrade_records WHERE 1=1`;
      let params = [];

      if (filters.status) {
        sql += ` AND status = ?`;
        params.push(filters.status);
      }
      if (filters.business_line) {
        sql += ` AND business_line = ?`;
        params.push(filters.business_line);
      }
      if (filters.cache_key) {
        sql += ` AND cache_key LIKE ?`;
        params.push(`%${filters.cache_key}%`);
      }

      sql += ` ORDER BY created_at DESC`;
      if (filters.limit) {
        sql += ` LIMIT ?`;
        params.push(filters.limit);
      }

      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  async queryCleanupTasks(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT ct.*, dr.business_line, dr.degrade_reason 
                 FROM cleanup_tasks ct
                 LEFT JOIN degrade_records dr ON ct.degrade_record_id = dr.id
                 WHERE 1=1`;
      let params = [];

      if (filters.status) {
        sql += ` AND ct.status = ?`;
        params.push(filters.status);
      }

      sql += ` ORDER BY ct.marked_at DESC`;

      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  async recordCacheHit(cacheKey, valueType, isNullCache = false) {
    return new Promise((resolve, reject) => {
      db.run(`INSERT INTO cache_hits (cache_key, value_type, is_null_cache)
              VALUES (?, ?, ?)`,
        [cacheKey, valueType, isNullCache ? 1 : 0],
        function(err) {
          if (err) return reject(err);
          resolve({ hitId: this.lastID, cacheKey, isNullCache });
        }
      );
    });
  }

  async checkAndMarkCleanup(cacheKey) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM degrade_records 
              WHERE cache_key = ? AND status = 'restore_applied'
              ORDER BY created_at DESC LIMIT 1`,
        [cacheKey],
        (err, degrade) => {
          if (err) return reject(err);
          if (!degrade) return resolve(null);

          db.get(`SELECT * FROM cleanup_tasks 
                  WHERE degrade_record_id = ? AND cache_key = ?`,
            [degrade.id, cacheKey],
            (err, existingTask) => {
              if (err) return reject(err);
              
              if (existingTask) {
                db.run(`UPDATE cleanup_tasks 
                        SET hit_count = hit_count + 1
                        WHERE id = ?`,
                  [existingTask.id]
                );
                resolve({ taskId: existingTask.id, isNew: false, hitCount: existingTask.hit_count + 1 });
              } else {
                db.run(`INSERT INTO cleanup_tasks (degrade_record_id, cache_key, hit_count)
                        VALUES (?, ?, 1)`,
                  [degrade.id, cacheKey],
                  function(err) {
                    if (err) return reject(err);
                    resolve({ taskId: this.lastID, isNew: true, hitCount: 1 });
                  }
                );
              }
            }
          );
        }
      );
    });
  }

  async getRecordById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM degrade_records WHERE id = ?`, [id], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }
}

module.exports = new DegradeService();