const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { FILE_TASK_STATUS, AUDIT_ACTION, DOWNLOAD_PERMISSION } = require('../config/constants');
const auditService = require('./auditService');
const rulesEngine = require('./rulesEngine');

class FileTaskService {
  async createTask(fileInfo, uploader) {
    const taskId = uuidv4();
    
    const task = {
      id: taskId,
      file_name: fileInfo.fileName,
      file_size: fileInfo.fileSize,
      file_hash: fileInfo.fileHash || null,
      uploader: uploader,
      business_id: fileInfo.businessId,
      status: FILE_TASK_STATUS.PENDING
    };

    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO file_tasks 
        (id, file_name, file_size, file_hash, uploader, business_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        task.id,
        task.file_name,
        task.file_size,
        task.file_hash,
        task.uploader,
        task.business_id,
        task.status,
        async (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          await auditService.logAction(
            task.id,
            AUDIT_ACTION.TASK_CREATED,
            uploader,
            {
              file_name: task.file_name,
              file_size: task.file_size,
              business_id: task.business_id
            },
            null,
            null,
            FILE_TASK_STATUS.PENDING
          );
          
          resolve(task);
        }
      );
      stmt.finalize();
    });
  }

  async getTask(taskId) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM file_tasks WHERE id = ?`, [taskId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getTasksByBusinessId(businessId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM file_tasks WHERE business_id = ? ORDER BY created_at DESC`,
        [businessId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async updateTaskStatus(taskId, newStatus, actor, details = {}) {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }
    
    const oldStatus = task.status;
    
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE file_tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [newStatus, taskId],
        async (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          await auditService.logAction(
            taskId,
            AUDIT_ACTION.SCAN_STARTED,
            actor,
            details,
            null,
            oldStatus,
            newStatus
          );
          
          resolve({ taskId, oldStatus, newStatus });
        }
      );
    });
  }

  async processScanCallback(taskId, scanResult, actor) {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }
    
    const oldStatus = task.status;
    const isSafe = scanResult.isSafe === true;
    const newStatus = isSafe ? FILE_TASK_STATUS.SAFE : FILE_TASK_STATUS.QUARANTINED;
    const action = isSafe 
      ? AUDIT_ACTION.SCAN_COMPLETED_SAFE 
      : AUDIT_ACTION.SCAN_COMPLETED_THREAT;

    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        UPDATE file_tasks 
        SET status = ?, 
            scan_engine = ?, 
            scan_result = ?, 
            threat_type = ?, 
            threat_details = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run(
        newStatus,
        scanResult.engine || null,
        JSON.stringify(scanResult),
        scanResult.threatType || null,
        scanResult.threatDetails || null,
        taskId,
        async (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          await auditService.logAction(
            taskId,
            action,
            actor,
            {
              scan_engine: scanResult.engine,
              is_safe: isSafe,
              threat_type: scanResult.threatType,
              threat_details: scanResult.threatDetails
            },
            null,
            oldStatus,
            newStatus
          );
          
          resolve({
            taskId,
            oldStatus,
            newStatus,
            isSafe,
            message: isSafe 
              ? '扫描完成，文件安全' 
              : `扫描发现威胁: ${scanResult.threatType || '未知威胁'}`
          });
        }
      );
      stmt.finalize();
    });
  }

  async checkDownloadPermission(taskId, requester) {
    const task = await this.getTask(taskId);
    if (!task) {
      return {
        permission: DOWNLOAD_PERMISSION.BLOCKED,
        reason: '任务不存在'
      };
    }
    
    await auditService.logAction(
      taskId,
      AUDIT_ACTION.DOWNLOAD_ATTEMPT,
      requester,
      {
        file_name: task.file_name,
        current_status: task.status
      }
    );
    
    const result = await rulesEngine.evaluateDownloadPermission(task, requester);
    
    if (result.permission === DOWNLOAD_PERMISSION.ALLOWED) {
      await auditService.logAction(
        taskId,
        AUDIT_ACTION.DOWNLOAD_ALLOWED,
        requester,
        {
          file_name: task.file_name,
          rule_applied: result.rule_applied
        },
        result.rule_applied
      );
    } else {
      await auditService.logAction(
        taskId,
        AUDIT_ACTION.DOWNLOAD_BLOCKED,
        requester,
        {
          file_name: task.file_name,
          current_status: task.status,
          rule_applied: result.rule_applied,
          block_reason: result.reason
        },
        result.rule_applied
      );
    }
    
    return result;
  }

  async requestFalsePositiveReview(taskId, requester, reason) {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }
    
    if (task.status !== FILE_TASK_STATUS.QUARANTINED) {
      throw new Error('只有已隔离的文件才能申请误报审核');
    }
    
    const oldStatus = task.status;
    const newStatus = FILE_TASK_STATUS.REVIEWING;

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        db.run(
          `UPDATE file_tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [newStatus, taskId],
          (err) => {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
              return;
            }
          }
        );
        
        const reviewStmt = db.prepare(`
          INSERT INTO false_positive_reviews (task_id, requester, reason)
          VALUES (?, ?, ?)
        `);
        
        reviewStmt.run(taskId, requester, reason, async function(err) {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
            return;
          }
          
          const reviewId = this.lastID;
          
          await auditService.logAction(
            taskId,
            AUDIT_ACTION.FALSE_POSITIVE_REQUESTED,
            requester,
            {
              review_id: reviewId,
              reason: reason,
              file_name: task.file_name
            },
            null,
            oldStatus,
            newStatus
          );
          
          db.run('COMMIT', (err) => {
            if (err) {
              reject(err);
              return;
            }
            
            resolve({
              reviewId,
              taskId,
              message: `误报审核申请已提交，审核编号: #${reviewId}`
            });
          });
        });
        
        reviewStmt.finalize();
      });
    });
  }

  async reviewFalsePositive(reviewId, reviewer, isApproved, comment) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM false_positive_reviews WHERE id = ?`,
        [reviewId],
        async (err, review) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (!review) {
            reject(new Error(`审核记录不存在: ${reviewId}`));
            return;
          }
          
          if (review.review_decision) {
            reject(new Error('该审核已处理过'));
            return;
          }
          
          const task = await this.getTask(review.task_id);
          if (!task) {
            reject(new Error(`关联任务不存在`));
            return;
          }
          
          const oldStatus = task.status;
          const newStatus = isApproved 
            ? FILE_TASK_STATUS.UNQUARANTINED 
            : FILE_TASK_STATUS.QUARANTINED;
          const action = isApproved 
            ? AUDIT_ACTION.FALSE_POSITIVE_APPROVED 
            : AUDIT_ACTION.FALSE_POSITIVE_REJECTED;
          
          db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            db.run(
              `UPDATE file_tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [newStatus, review.task_id],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  reject(err);
                  return;
                }
              }
            );
            
            db.run(
              `UPDATE false_positive_reviews 
               SET reviewer = ?, review_comment = ?, review_decision = ?, reviewed_at = CURRENT_TIMESTAMP
               WHERE id = ?`,
              [reviewer, comment, isApproved ? 'approved' : 'rejected', reviewId],
              async (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  reject(err);
                  return;
                }
                
                await auditService.logAction(
                  review.task_id,
                  action,
                  reviewer,
                  {
                    review_id: reviewId,
                    comment: comment,
                    is_approved: isApproved
                  },
                  null,
                  oldStatus,
                  newStatus
                );
                
                db.run('COMMIT', (err) => {
                  if (err) {
                    reject(err);
                    return;
                  }
                  
                  resolve({
                    reviewId,
                    taskId: review.task_id,
                    isApproved,
                    message: isApproved 
                      ? '误报审核通过，文件已解除隔离' 
                      : '误报审核未通过，文件保持隔离状态'
                  });
                });
              }
            );
          });
        }
      );
    });
  }

  async getFalsePositiveReviews(filters = {}) {
    let query = `SELECT * FROM false_positive_reviews WHERE 1=1`;
    const params = [];
    
    if (filters.taskId) {
      query += ` AND task_id = ?`;
      params.push(filters.taskId);
    }
    
    if (filters.requester) {
      query += ` AND requester = ?`;
      params.push(filters.requester);
    }
    
    if (filters.reviewDecision) {
      query += ` AND review_decision = ?`;
      params.push(filters.reviewDecision);
    }
    
    query += ` ORDER BY created_at DESC`;
    
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getTaskStats() {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT status, COUNT(*) as count 
        FROM file_tasks 
        GROUP BY status
      `, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        const stats = {};
        Object.values(FILE_TASK_STATUS).forEach(s => {
          stats[s] = 0;
        });
        
        rows.forEach(r => {
          stats[r.status] = r.count;
        });
        
        resolve(stats);
      });
    });
  }
}

module.exports = new FileTaskService();
