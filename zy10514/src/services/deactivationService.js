const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');

const STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  PARTIAL_SUCCESS: 'PARTIAL_SUCCESS',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  NEEDS_MANUAL: 'NEEDS_MANUAL',
  MANUALLY_COMPLETED: 'MANUALLY_COMPLETED'
};

class DeactivationService {
  createTask(employeeId, employeeName, requestedBy, systems, accountMap = {}) {
    const taskId = uuidv4();
    const systemList = Array.isArray(systems) ? systems : systems.split(',');
    const validSystems = this._getValidSystems(systemList);
    
    if (validSystems.length === 0) {
      throw new Error('没有有效的系统ID');
    }

    const originalRequest = JSON.stringify({
      employeeId,
      employeeName,
      requestedBy,
      systems,
      accountMap,
      timestamp: new Date().toISOString()
    });

    db.transaction(() => {
      const insertTask = db.prepare(`
        INSERT INTO deactivation_tasks 
        (id, employee_id, employee_name, requested_by, systems, status, total_systems, original_request)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertTask.run(
        taskId,
        employeeId,
        employeeName || null,
        requestedBy,
        JSON.stringify(validSystems.map(s => s.id)),
        STATUS.PENDING,
        validSystems.length,
        originalRequest
      );

      const insertItem = db.prepare(`
        INSERT INTO task_items (id, task_id, system_id, system_name, account_identifier, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      validSystems.forEach(system => {
        insertItem.run(
          uuidv4(),
          taskId,
          system.id,
          system.name,
          accountMap[system.id] || employeeId,
          STATUS.PENDING
        );
      });

      this._addAuditLog(taskId, null, 'TASK_CREATED', requestedBy, {
        systems: validSystems.map(s => s.name)
      });
    })();

    return this.getTask(taskId);
  }

  _getValidSystems(systemIds) {
    const placeholders = systemIds.map(() => '?').join(',');
    const stmt = db.prepare(`SELECT id, name FROM systems WHERE id IN (${placeholders}) AND enabled = 1`);
    return stmt.all(...systemIds);
  }

  getTask(taskId) {
    const task = db.prepare('SELECT * FROM deactivation_tasks WHERE id = ?').get(taskId);
    if (!task) return null;

    task.systems = JSON.parse(task.systems);
    task.original_request = JSON.parse(task.original_request);
    
    const items = db.prepare('SELECT * FROM task_items WHERE task_id = ? ORDER BY system_name').all(taskId);
    items.forEach(item => {
      if (item.raw_response) item.raw_response = JSON.parse(item.raw_response);
    });

    return { ...task, items };
  }

  listTasks(filters = {}) {
    let query = 'SELECT * FROM deactivation_tasks WHERE 1=1';
    const params = [];

    if (filters.employeeId) {
      query += ' AND employee_id = ?';
      params.push(filters.employeeId);
    }
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.requestedBy) {
      query += ' AND requested_by = ?';
      params.push(filters.requestedBy);
    }

    query += ' ORDER BY created_at DESC LIMIT 100';

    const tasks = db.prepare(query).all(...params);
    return tasks.map(t => ({
      ...t,
      systems: JSON.parse(t.systems),
      original_request: JSON.parse(t.original_request)
    }));
  }

  startTask(taskId, actor) {
    const task = this.getTask(taskId);
    if (!task) throw new Error('任务不存在');
    if (task.status !== STATUS.PENDING) throw new Error('任务状态不正确');

    db.prepare(`
      UPDATE deactivation_tasks 
      SET status = ?, started_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(STATUS.PROCESSING, taskId);

    this._addAuditLog(taskId, null, 'TASK_STARTED', actor);

    return this.getTask(taskId);
  }

  processItem(taskId, itemId, actor) {
    const task = this.getTask(taskId);
    if (!task) throw new Error('任务不存在');

    const item = db.prepare('SELECT * FROM task_items WHERE id = ? AND task_id = ?').get(itemId, taskId);
    if (!item) throw new Error('任务项不存在');
    if (item.status === STATUS.SUCCESS) throw new Error('该账号已成功停用');

    const result = this._callSystemDeactivation(item.system_id, item.account_identifier);
    
    const now = new Date().toISOString();

    if (result.success) {
      db.prepare(`
        UPDATE task_items 
        SET status = ?, attempts = attempts + 1, last_attempt_at = ?, completed_at = ?, raw_response = ?
        WHERE id = ?
      `).run(STATUS.SUCCESS, now, now, JSON.stringify(result.raw), itemId);
    } else {
      db.prepare(`
        UPDATE task_items 
        SET status = ?, attempts = attempts + 1, last_attempt_at = ?, error_code = ?, error_message = ?, raw_response = ?
        WHERE id = ?
      `).run(STATUS.FAILED, now, result.errorCode, result.errorMessage, JSON.stringify(result.raw), itemId);
    }

    this._addAuditLog(taskId, itemId, result.success ? 'ITEM_SUCCESS' : 'ITEM_FAILED', actor, {
      system: item.system_name,
      error: result.errorMessage
    });

    this._updateTaskStatus(taskId);
    return this.getTask(taskId);
  }

  retryItem(taskId, itemId, actor) {
    const item = db.prepare('SELECT * FROM task_items WHERE id = ? AND task_id = ?').get(itemId, taskId);
    if (!item) throw new Error('任务项不存在');
    
    if (item.attempts >= 3 && !item.manually_corrected) {
      throw new Error('超过最大重试次数，请进行人工处理');
    }

    return this.processItem(taskId, itemId, actor);
  }

  manualCorrect(taskId, itemId, actor, correctionNote, markAsSuccess = true) {
    const item = db.prepare('SELECT * FROM task_items WHERE id = ? AND task_id = ?').get(itemId, taskId);
    if (!item) throw new Error('任务项不存在');

    const now = new Date().toISOString();
    const newStatus = markAsSuccess ? STATUS.MANUALLY_COMPLETED : STATUS.NEEDS_MANUAL;

    db.prepare(`
      UPDATE task_items 
      SET status = ?, manually_corrected = 1, corrected_by = ?, corrected_at = ?, correction_note = ?
      WHERE id = ?
    `).run(newStatus, actor, now, correctionNote, itemId);

    this._addAuditLog(taskId, itemId, 'MANUAL_CORRECTION', actor, {
      system: item.system_name,
      note: correctionNote,
      markedAsSuccess
    });

    this._updateTaskStatus(taskId);
    return this.getTask(taskId);
  }

  _updateTaskStatus(taskId) {
    const items = db.prepare('SELECT status FROM task_items WHERE task_id = ?').all(taskId);
    
    const counts = {
      total: items.length,
      completed: items.filter(i => i.status === STATUS.SUCCESS || i.status === STATUS.MANUALLY_COMPLETED).length,
      failed: items.filter(i => i.status === STATUS.FAILED).length,
      pending: items.filter(i => i.status === STATUS.PENDING || i.status === STATUS.PROCESSING).length,
      needsManual: items.filter(i => i.status === STATUS.NEEDS_MANUAL).length
    };

    let taskStatus;
    if (counts.pending > 0) {
      taskStatus = STATUS.PROCESSING;
    } else if (counts.needsManual > 0) {
      taskStatus = STATUS.NEEDS_MANUAL;
    } else if (counts.failed > 0) {
      taskStatus = STATUS.PARTIAL_SUCCESS;
    } else {
      taskStatus = STATUS.SUCCESS;
    }

    db.prepare(`
      UPDATE deactivation_tasks 
      SET status = ?, completed_systems = ?, failed_systems = ?, completed_at = ?
      WHERE id = ?
    `).run(
      taskStatus, 
      counts.completed, 
      counts.failed,
      counts.pending === 0 ? new Date().toISOString() : null,
      taskId
    );
  }

  _callSystemDeactivation(systemId, accountId) {
    const mockResults = {
      AD: { success: Math.random() > 0.1 },
      EMAIL: { success: Math.random() > 0.15 },
      VPN: { success: Math.random() > 0.05 },
      CRM: { success: Math.random() > 0.2 },
      HR: { success: Math.random() > 0.1 },
      FINANCE: { success: Math.random() > 0.25 },
      GIT: { success: Math.random() > 0.15 },
      JIRA: { success: Math.random() > 0.2 },
      CONFLUENCE: { success: Math.random() > 0.1 },
      SLACK: { success: Math.random() > 0.05 }
    };

    const result = mockResults[systemId] || { success: Math.random() > 0.2 };

    if (result.success) {
      return {
        success: true,
        raw: {
          timestamp: new Date().toISOString(),
          system: systemId,
          account: accountId,
          action: 'deactivated',
          requestId: uuidv4()
        }
      };
    } else {
      const errors = [
        { code: 'API_TIMEOUT', message: '系统响应超时，请稍后重试' },
        { code: 'ACCOUNT_NOT_FOUND', message: '在该系统中未找到此账号' },
        { code: 'PERMISSION_DENIED', message: 'API权限不足，请检查配置' },
        { code: 'SYSTEM_MAINTENANCE', message: '系统正在维护中' },
        { code: 'DEPENDENCY_ERROR', message: '存在依赖关系，需要先处理其他账号' }
      ];
      const error = errors[Math.floor(Math.random() * errors.length)];
      return {
        success: false,
        errorCode: error.code,
        errorMessage: error.message,
        raw: {
          timestamp: new Date().toISOString(),
          system: systemId,
          account: accountId,
          error: error.code,
          requestId: uuidv4()
        }
      };
    }
  }

  _addAuditLog(taskId, itemId, action, actor, details = {}) {
    db.prepare(`
      INSERT INTO audit_logs (id, task_id, item_id, action, actor, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), taskId, itemId, action, actor, JSON.stringify(details));
  }

  getAuditLogs(taskId) {
    const logs = db.prepare('SELECT * FROM audit_logs WHERE task_id = ? ORDER BY created_at DESC').all(taskId);
    return logs.map(l => ({
      ...l,
      details: JSON.parse(l.details)
    }));
  }

  getAllSystems() {
    return db.prepare('SELECT id, name, description, enabled FROM systems ORDER BY name').all();
  }
}

module.exports = { DeactivationService, STATUS };
