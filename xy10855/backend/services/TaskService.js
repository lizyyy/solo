const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

class TaskService {
  static async createTask(templateId, taskName, parameters, createdBy = 'system') {
    return new Promise((resolve, reject) => {
      const taskId = `task-${Date.now()}-${uuidv4().substring(0, 8)}`;
      const parametersSnapshot = JSON.stringify(parameters);
      
      db.get(
        `SELECT id FROM report_tasks 
         WHERE template_id = ? AND parameters_snapshot = ? AND status IN ('pending', 'running')
         LIMIT 1`,
        [templateId, parametersSnapshot],
        (err, existingTask) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (existingTask) {
            resolve({
              taskId: existingTask.id,
              isNew: false,
              message: '检测到相同参数的任务正在执行，已复用现有任务'
            });
            return;
          }

          db.run(
            `INSERT INTO report_tasks 
             (id, template_id, task_name, parameters_snapshot, status, created_by, progress, total_steps)
             VALUES (?, ?, ?, ?, 'pending', ?, 0, 100)`,
            [taskId, templateId, taskName, parametersSnapshot, createdBy],
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              this.addProgressEvent(taskId, 'created', '任务已创建，等待执行', 0);
              resolve({
                taskId,
                isNew: true,
                message: '任务创建成功'
              });
            }
          );
        }
      );
    });
  }

  static async addProgressEvent(taskId, eventType, message, progress, details = null) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO progress_events (task_id, event_type, message, progress, details)
         VALUES (?, ?, ?, ?, ?)`,
        [taskId, eventType, message, progress, details ? JSON.stringify(details) : null],
        (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (progress !== null && progress !== undefined) {
            db.run(
              `UPDATE report_tasks SET progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [progress, taskId]
            );
          }
          resolve();
        }
      );
    });
  }

  static async startTask(taskId) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE report_tasks 
         SET status = 'running', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status IN ('pending', 'failed')`,
        [taskId],
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          
          if (this.changes === 0) {
            reject(new Error('任务状态不允许启动'));
            return;
          }

          this.addProgressEvent(taskId, 'start', '任务开始执行', 10);
          resolve();
        }.bind(this)
      );
    });
  }

  static async simulateTaskProgress(taskId) {
    const steps = [
      { progress: 20, message: '正在查询数据源...', delay: 800 },
      { progress: 40, message: '正在处理数据转换...', delay: 1200 },
      { progress: 60, message: '正在计算统计指标...', delay: 1000 },
      { progress: 80, message: '正在生成报告文件...', delay: 1500 },
      { progress: 95, message: '正在压缩和保存...', delay: 600 }
    ];

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, step.delay));
      await this.addProgressEvent(taskId, 'progress', step.message, step.progress);
    }
  }

  static async completeTask(taskId) {
    return new Promise((resolve, reject) => {
      const fileName = `report-${taskId}.xlsx`;
      const filePath = `/uploads/${fileName}`;
      const fileSize = Math.floor(Math.random() * 5000000) + 1000000;

      db.run(
        `UPDATE report_tasks 
         SET status = 'completed', progress = 100, completed_at = CURRENT_TIMESTAMP, 
             updated_at = CURRENT_TIMESTAMP, file_path = ?, file_name = ?, file_size = ?
         WHERE id = ?`,
        [filePath, fileName, fileSize, taskId],
        (err) => {
          if (err) {
            reject(err);
            return;
          }
          this.addProgressEvent(taskId, 'completed', '任务完成，报告已生成', 100);
          resolve({ filePath, fileName, fileSize });
        }
      );
    });
  }

  static async failTask(taskId, error, errorCode = 'UNKNOWN_ERROR') {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE report_tasks 
         SET status = 'failed', failed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [taskId],
        (err) => {
          if (err) {
            reject(err);
            return;
          }

          db.run(
            `INSERT INTO failure_reasons (task_id, error_message, error_stack, error_code)
             VALUES (?, ?, ?, ?)`,
            [taskId, error.message, error.stack, errorCode],
            () => {
              this.addProgressEvent(taskId, 'failed', `任务失败: ${error.message}`, null, { errorCode });
              resolve();
            }
          );
        }
      );
    });
  }

  static async retryTask(taskId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT status, retry_count, max_retries FROM report_tasks WHERE id = ?`,
        [taskId],
        (err, task) => {
          if (err) {
            reject(err);
            return;
          }

          if (!task) {
            reject(new Error('任务不存在'));
            return;
          }

          if (task.status !== 'failed') {
            reject(new Error('只有失败的任务才能重试'));
            return;
          }

          if (task.retry_count >= task.max_retries) {
            reject(new Error('已达到最大重试次数'));
            return;
          }

          db.run(
            `UPDATE report_tasks 
             SET status = 'pending', retry_count = retry_count + 1,
                 started_at = NULL, completed_at = NULL, failed_at = NULL,
                 progress = 0, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [taskId],
            (err) => {
              if (err) {
                reject(err);
                return;
              }

              this.addProgressEvent(taskId, 'retry', `任务重试中 (第 ${task.retry_count + 1} 次)`, 0);
              resolve({ retryCount: task.retry_count + 1 });
            }
          );
        }
      );
    });
  }

  static async getTaskList(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `SELECT t.*, tm.name as template_name 
                   FROM report_tasks t 
                   LEFT JOIN report_templates tm ON t.template_id = tm.id
                   WHERE 1=1`;
      const params = [];

      if (filters.status) {
        query += ` AND t.status = ?`;
        params.push(filters.status);
      }

      if (filters.templateId) {
        query += ` AND t.template_id = ?`;
        params.push(filters.templateId);
      }

      if (filters.keyword) {
        query += ` AND (t.task_name LIKE ? OR t.id LIKE ?)`;
        params.push(`%${filters.keyword}%`, `%${filters.keyword}%`);
      }

      query += ` ORDER BY t.created_at DESC`;

      if (filters.limit) {
        query += ` LIMIT ?`;
        params.push(filters.limit);
      }

      if (filters.offset) {
        query += ` OFFSET ?`;
        params.push(filters.offset);
      }

      db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows.map(row => ({
          ...row,
          parameters_snapshot: JSON.parse(row.parameters_snapshot)
        })));
      });
    });
  }

  static async getTaskDetail(taskId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT t.*, tm.name as template_name 
         FROM report_tasks t 
         LEFT JOIN report_templates tm ON t.template_id = tm.id
         WHERE t.id = ?`,
        [taskId],
        (err, task) => {
          if (err) {
            reject(err);
            return;
          }

          if (!task) {
            resolve(null);
            return;
          }

          db.all(
            `SELECT * FROM progress_events WHERE task_id = ? ORDER BY timestamp ASC`,
            [taskId],
            (err, events) => {
              if (err) {
                reject(err);
                return;
              }

              db.all(
                `SELECT * FROM failure_reasons WHERE task_id = ? ORDER BY created_at DESC`,
                [taskId],
                (err, failures) => {
                  if (err) {
                    reject(err);
                    return;
                  }

                  resolve({
                    ...task,
                    parameters_snapshot: JSON.parse(task.parameters_snapshot),
                    events,
                    failures
                  });
                }
              );
            }
          );
        }
      );
    });
  }

  static async getTaskProgress(taskId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT status, progress, total_steps FROM report_tasks WHERE id = ?`,
        [taskId],
        (err, result) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(result || null);
        }
      );
    });
  }

  static async cleanupStuckTasks() {
    return new Promise((resolve, reject) => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      db.all(
        `SELECT id FROM report_tasks 
         WHERE status = 'running' AND updated_at < ?`,
        [fiveMinutesAgo],
        async (err, tasks) => {
          if (err) {
            reject(err);
            return;
          }

          for (const task of tasks) {
            await this.addProgressEvent(task.id, 'timeout', '任务执行超时，被系统检测为卡住', null);
            await this.failTask(task.id, new Error('任务执行超时'), 'TASK_TIMEOUT');
          }

          resolve({ cleanedCount: tasks.length });
        }
      );
    });
  }
}

module.exports = TaskService;
