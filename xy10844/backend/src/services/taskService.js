const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { STAGES, STATUSES, STAGE_TRANSITIONS } = require('../constants/stages');

class TaskService {
  static async createTask(data) {
    const now = Date.now();
    const task = {
      id: uuidv4(),
      index_name: data.indexName,
      data_source: data.dataSource,
      stage: STAGES.INIT,
      status: STATUSES.PENDING,
      target_version: data.targetVersion,
      current_version: data.currentVersion || null,
      verify_query: data.verifyQuery || null,
      created_by: data.createdBy || 'system',
      state_reason: '任务创建成功，等待执行',
      created_at: now,
      updated_at: now
    };

    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO index_rebuild_tasks 
        (id, index_name, data_source, stage, status, target_version, current_version, verify_query, created_by, state_reason, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      db.run(sql, [
        task.id, task.index_name, task.data_source, task.stage, task.status,
        task.target_version, task.current_version, task.verify_query,
        task.created_by, task.state_reason, task.created_at, task.updated_at
      ], function(err) {
        if (err) reject(err);
        else resolve(task);
      });
    });
  }

  static async getTaskById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM index_rebuild_tasks WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getTasks(filters = {}) {
    let sql = 'SELECT * FROM index_rebuild_tasks WHERE 1=1';
    const params = [];

    if (filters.stage) {
      sql += ' AND stage = ?';
      params.push(filters.stage);
    }
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.indexName) {
      sql += ' AND index_name LIKE ?';
      params.push(`%${filters.indexName}%`);
    }

    sql += ' ORDER BY created_at DESC';

    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async updateStage(taskId, newStage, newStatus, reason, operator = 'system') {
    const task = await this.getTaskById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    if (newStage !== task.stage) {
      const transition = STAGE_TRANSITIONS[task.stage];
      if (!transition.allowedTo.includes(newStage)) {
        throw new Error(`不允许从 ${task.stage} 切换到 ${newStage}`);
      }
    }

    const targetStage = newStage !== task.stage ? newStage : task.stage;
    const targetTransition = STAGE_TRANSITIONS[targetStage];
    if (!targetTransition.allowedStatuses.includes(newStatus)) {
      throw new Error(`阶段 ${targetStage} 不允许状态 ${newStatus}`);
    }

    const now = Date.now();
    const updates = {
      stage: newStage,
      status: newStatus,
      state_reason: reason,
      updated_at: now
    };

    if (newStage === STAGES.COMPLETED || newStage === STAGES.ROLLED_BACK) {
      updates.completed_at = now;
    }

    await this.addTaskLog(taskId, task.stage, 'stage_update', newStatus, reason, operator);

    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE index_rebuild_tasks 
        SET stage = ?, status = ?, state_reason = ?, updated_at = ?, completed_at = COALESCE(?, completed_at)
        WHERE id = ?
      `;
      db.run(sql, [updates.stage, updates.status, updates.state_reason, updates.updated_at, updates.completed_at || null, taskId], function(err) {
        if (err) reject(err);
        else resolve({ ...task, ...updates });
      });
    });
  }

  static async pauseTask(taskId, pausePoint, reason, operator) {
    const task = await this.getTaskById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    if (task.status === STATUSES.PAUSED) {
      throw new Error('任务已经暂停');
    }

    const now = Date.now();
    await this.addTaskLog(taskId, task.stage, 'pause', STATUSES.PAUSED, reason, operator);

    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE index_rebuild_tasks 
        SET status = ?, pause_point = ?, state_reason = ?, updated_at = ?
        WHERE id = ?
      `;
      db.run(sql, [STATUSES.PAUSED, pausePoint, reason, now, taskId], function(err) {
        if (err) reject(err);
        else resolve({ ...task, status: STATUSES.PAUSED, pause_point: pausePoint, state_reason: reason });
      });
    });
  }

  static async resumeTask(taskId, reason, operator) {
    const task = await this.getTaskById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    if (task.status !== STATUSES.PAUSED) {
      throw new Error('任务未暂停，无法恢复');
    }

    const now = Date.now();
    const newStatus = STATUSES.RUNNING;
    await this.addTaskLog(taskId, task.stage, 'resume', newStatus, reason, operator);

    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE index_rebuild_tasks 
        SET status = ?, state_reason = ?, updated_at = ?
        WHERE id = ?
      `;
      db.run(sql, [newStatus, reason, now, taskId], function(err) {
        if (err) reject(err);
        else resolve({ ...task, status: newStatus, state_reason: reason });
      });
    });
  }

  static async updateVerifyResult(taskId, verifyResult, passed, operator) {
    const task = await this.getTaskById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    const now = Date.now();
    const newStatus = passed ? STATUSES.SUCCESS : STATUSES.BLOCKED;
    const reason = passed ? '验证查询通过' : '验证查询不通过，已拦截';

    await this.addTaskLog(taskId, STAGES.VERIFICATION, 'verify', newStatus, reason, operator);

    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE index_rebuild_tasks 
        SET verify_result = ?, status = ?, state_reason = ?, updated_at = ?
        WHERE id = ?
      `;
      db.run(sql, [verifyResult, newStatus, reason, now, taskId], function(err) {
        if (err) reject(err);
        else resolve({ ...task, verify_result: verifyResult, status: newStatus, state_reason: reason });
      });
    });
  }

  static async updateGrayTraffic(taskId, percentage, operator) {
    const task = await this.getTaskById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    if (percentage < 0 || percentage > 100) {
      throw new Error('灰度流量百分比必须在0-100之间');
    }

    const now = Date.now();
    const reason = `灰度流量调整为 ${percentage}%`;

    await this.addSwitchRecord(taskId, 'gray', task.current_version, task.target_version, percentage, operator);
    await this.addTaskLog(taskId, STAGES.GRAY_RELEASE, 'gray_update', STATUSES.RUNNING, reason, operator);

    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE index_rebuild_tasks 
        SET gray_traffic_percentage = ?, state_reason = ?, updated_at = ?
        WHERE id = ?
      `;
      db.run(sql, [percentage, reason, now, taskId], function(err) {
        if (err) reject(err);
        else resolve({ ...task, gray_traffic_percentage: percentage, state_reason: reason });
      });
    });
  }

  static async rollback(taskId, reason, operator) {
    const task = await this.getTaskById(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    if (!task.current_version) {
      throw new Error('没有可回滚的版本');
    }

    const now = Date.now();
    
    await this.addSwitchRecord(taskId, 'rollback', task.target_version, task.current_version, 0, operator, reason);
    await this.addTaskLog(taskId, task.stage, 'rollback', STATUSES.SUCCESS, reason, operator);

    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE index_rebuild_tasks 
        SET stage = ?, status = ?, state_reason = ?, gray_traffic_percentage = 0, updated_at = ?, completed_at = ?
        WHERE id = ?
      `;
      db.run(sql, [STAGES.ROLLED_BACK, STATUSES.SUCCESS, reason, now, now, taskId], function(err) {
        if (err) reject(err);
        else resolve({ ...task, stage: STAGES.ROLLED_BACK, status: STATUSES.SUCCESS, state_reason: reason });
      });
    });
  }

  static async addTaskLog(taskId, stage, action, status, message, operator) {
    const log = {
      id: uuidv4(),
      task_id: taskId,
      stage,
      action,
      status,
      message,
      operator,
      created_at: Date.now()
    };

    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO task_logs (id, task_id, stage, action, status, message, operator, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      db.run(sql, [log.id, log.task_id, log.stage, log.action, log.status, log.message, log.operator, log.created_at], function(err) {
        if (err) reject(err);
        else resolve(log);
      });
    });
  }

  static async getTaskLogs(taskId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM task_logs WHERE task_id = ? ORDER BY created_at DESC', [taskId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async addSwitchRecord(taskId, switchType, fromVersion, toVersion, trafficPercentage, operator, rollbackReason = null) {
    const record = {
      id: uuidv4(),
      task_id: taskId,
      switch_type: switchType,
      from_version: fromVersion,
      to_version: toVersion,
      traffic_percentage: trafficPercentage,
      operator,
      rollback_reason: rollbackReason,
      created_at: Date.now()
    };

    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO switch_records (id, task_id, switch_type, from_version, to_version, traffic_percentage, operator, rollback_reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      db.run(sql, [record.id, record.task_id, record.switch_type, record.from_version, record.to_version, record.traffic_percentage, record.operator, record.rollback_reason, record.created_at], function(err) {
        if (err) reject(err);
        else resolve(record);
      });
    });
  }

  static async getSwitchRecords(taskId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM switch_records WHERE task_id = ? ORDER BY created_at DESC', [taskId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getAllTasksForExport() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          t.id,
          t.index_name,
          t.data_source,
          t.stage,
          t.status,
          t.current_version,
          t.target_version,
          t.verify_query,
          t.verify_result,
          t.gray_traffic_percentage,
          t.error_message,
          t.state_reason,
          t.created_by,
          t.created_at,
          t.updated_at,
          t.completed_at,
          GROUP_CONCAT(l.message, ' | ') as log_messages,
          COUNT(l.id) as log_count
        FROM index_rebuild_tasks t
        LEFT JOIN task_logs l ON t.id = l.task_id
        GROUP BY t.id
        ORDER BY t.created_at DESC
      `;
      db.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = TaskService;