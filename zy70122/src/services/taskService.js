const db = require('../config/database');
const { generateId } = require('../utils/common');
const settlementService = require('./settlementService');
const reportService = require('./reportService');

class TaskService {
  createTask(taskType, taskName, payload, settlementCycleId) {
    const id = generateId();
    const stmt = db.prepare(`
      INSERT INTO background_tasks (
        id, task_type, task_name, payload, settlement_cycle_id, status
      ) VALUES (?, ?, ?, ?, ?, 'pending')
    `);
    stmt.run(
      id, 
      taskType, 
      taskName, 
      payload ? JSON.stringify(payload) : null,
      settlementCycleId
    );
    return this.getTask(id);
  }

  getTask(id) {
    const task = db.prepare('SELECT * FROM background_tasks WHERE id = ?').get(id);
    if (task && task.payload) {
      try {
        task.payload = JSON.parse(task.payload);
      } catch (e) {}
    }
    return task;
  }

  listTasks(status) {
    if (status) {
      return db.prepare(`
        SELECT * FROM background_tasks 
        WHERE status = ?
        ORDER BY created_at DESC
      `).all(status);
    }
    return db.prepare(`
      SELECT * FROM background_tasks 
      ORDER BY created_at DESC
      LIMIT 100
    `).all();
  }

  listTasksByCycle(settlementCycleId) {
    return db.prepare(`
      SELECT * FROM background_tasks 
      WHERE settlement_cycle_id = ?
      ORDER BY created_at DESC
    `).all(settlementCycleId);
  }

  _updateTaskStatus(taskId, status, errorMessage = null) {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE background_tasks 
      SET status = ?, 
          error_message = ?,
          ${status === 'running' ? 'started_at = ?' : ''}
          ${status === 'completed' || status === 'failed' ? 'completed_at = ?' : ''}
      WHERE id = ?
    `);
    
    const params = [status, errorMessage];
    if (status === 'running') {
      params.push(now);
    }
    if (status === 'completed' || status === 'failed') {
      params.push(now);
    }
    params.push(taskId);
    
    stmt.run(...params);
  }

  executeTask(taskId) {
    const task = this.getTask(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }
    
    if (task.status === 'completed') {
      return { success: true, message: '任务已完成，无需重复执行' };
    }
    
    db.transaction(() => {
      this._updateTaskStatus(taskId, 'running');
      db.prepare(`
        UPDATE background_tasks 
        SET retry_count = retry_count + 1 
        WHERE id = ?
      `).run(taskId);
    });
    
    try {
      let result;
      
      switch (task.task_type) {
        case 'settlement_calc':
          result = this._executeSettlementCalc(task);
          break;
        case 'settlement_report':
          result = this._executeSettlementReport(task);
          break;
        case 'data_sync':
          result = this._executeDataSync(task);
          break;
        default:
          throw new Error(`未知任务类型: ${task.task_type}`);
      }
      
      this._updateTaskStatus(taskId, 'completed');
      return { success: true, message: '任务执行成功', result };
      
    } catch (error) {
      const currentTask = this.getTask(taskId);
      const retryCount = currentTask.retry_count || 0;
      const maxRetries = currentTask.max_retries || 3;
      
      let finalStatus;
      if (retryCount < maxRetries) {
        finalStatus = 'pending';
      } else {
        finalStatus = 'failed';
      }
      
      this._updateTaskStatus(taskId, finalStatus, error.message);
      
      return {
        success: false,
        message: finalStatus === 'failed' 
          ? '任务执行失败，已达到最大重试次数' 
          : '任务执行失败，将自动重试',
        error: error.message,
        retryCount,
        maxRetries,
        willRetry: finalStatus === 'pending'
      };
    }
  }

  _executeSettlementCalc(task) {
    const cycleId = task.settlement_cycle_id;
    if (!cycleId) {
      throw new Error('缺少结算周期ID');
    }
    return settlementService.calculateSettlement(cycleId);
  }

  _executeSettlementReport(task) {
    const cycleId = task.settlement_cycle_id;
    if (!cycleId) {
      throw new Error('缺少结算周期ID');
    }
    return reportService.generateSettlementReport(cycleId);
  }

  _executeDataSync(task) {
    return { message: '数据同步任务' };
  }

  executePendingTasks() {
    const pendingTasks = db.prepare(`
      SELECT id FROM background_tasks 
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `).all();
    
    const results = [];
    for (const task of pendingTasks) {
      results.push({
        taskId: task.id,
        ...this.executeTask(task.id)
      });
    }
    return results;
  }

  retryTask(taskId) {
    const task = this.getTask(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }
    
    if (task.status !== 'failed') {
      throw new Error('只有失败状态的任务才能手动重试');
    }
    
    db.prepare(`
      UPDATE background_tasks 
      SET status = 'pending',
          retry_count = 0,
          error_message = NULL,
          started_at = NULL,
          completed_at = NULL
      WHERE id = ?
    `).run(taskId);
    
    return this.getTask(taskId);
  }

  getTaskStatusDescription(task) {
    const statusLabels = {
      pending: '待执行',
      running: '执行中',
      completed: '已完成',
      failed: '执行失败'
    };
    
    const desc = {
      status: task.status,
      statusLabel: statusLabels[task.status] || task.status,
      retryCount: task.retry_count,
      maxRetries: task.max_retries
    };
    
    if (task.status === 'failed') {
      desc.error = task.error_message;
      desc.canRetry = true;
      desc.action = '可以调用重试接口重新执行任务';
    } else if (task.status === 'pending') {
      if (task.retry_count > 0) {
        desc.action = `任务已自动重试 ${task.retry_count} 次，还有 ${task.max_retries - task.retry_count} 次重试机会`;
      } else {
        desc.action = '任务等待执行中';
      }
    } else if (task.status === 'running') {
      desc.action = '任务正在执行，请稍后查询状态';
    }
    
    return desc;
  }
}

module.exports = new TaskService();
