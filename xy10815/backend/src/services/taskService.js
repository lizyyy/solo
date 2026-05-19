const db = require('../database/db');
const stateMachine = require('./stateMachine');

function promisifyDb(method, sql, params = []) {
  return new Promise((resolve, reject) => {
    db[method](sql, params, function(err, result) {
      if (err) reject(err);
      else resolve({ result, lastId: this.lastID, changes: this.changes });
    });
  });
}

async function createTask(taskType, businessNo, totalCount = 0) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM tasks WHERE task_type = ? AND business_no = ?', 
      [taskType, businessNo], (err, row) => {
        if (err) return reject(err);
        if (row) return resolve({ id: row.id, isNew: false });

        db.run(`INSERT INTO tasks (task_type, business_no, total_count, current_status) 
                VALUES (?, ?, ?, 'PENDING')`, 
          [taskType, businessNo, totalCount], async function(err) {
            if (err) return reject(err);
            const taskId = this.lastID;
            await addStatusEvent(taskId, 'PENDING', '任务创建成功');
            resolve({ id: taskId, isNew: true });
          });
      });
  });
}

async function addStatusEvent(taskId, status, message = '') {
  await promisifyDb('run', 
    'INSERT INTO status_events (task_id, status, message) VALUES (?, ?, ?)',
    [taskId, status, message]
  );
  await promisifyDb('run',
    'UPDATE tasks SET current_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, taskId]
  );
}

async function updateTaskStatus(taskId, newStatus, message = '') {
  const task = await getTaskById(taskId);
  if (!task) throw new Error('任务不存在');
  
  if (!stateMachine.canTransition(task.current_status, newStatus)) {
    throw new Error(`无法从 ${task.current_status} 转换到 ${newStatus}`);
  }

  await addStatusEvent(taskId, newStatus, message);
  return getTaskById(taskId);
}

async function addProgressSnapshot(taskId, progress, successCount = 0, failCount = 0, details = '') {
  await promisifyDb('run',
    `INSERT INTO progress_snapshots (task_id, progress, success_count, fail_count, details) 
     VALUES (?, ?, ?, ?, ?)`,
    [taskId, progress, successCount, failCount, details]
  );

  await promisifyDb('run',
    `UPDATE tasks SET progress = ?, success_count = success_count + ?, 
                      fail_count = fail_count + ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [progress, successCount, failCount, taskId]
  );
}

async function recordFailure(taskId, errorCode, errorMessage, stackTrace = '') {
  const result = await promisifyDb('run',
    `INSERT INTO failure_records (task_id, error_code, error_message, stack_trace) 
     VALUES (?, ?, ?, ?)`,
    [taskId, errorCode, errorMessage, stackTrace]
  );

  await updateTaskStatus(taskId, 'FAILED', errorMessage);
  return result.lastId;
}

async function retryTask(taskId) {
  const task = await getTaskById(taskId);
  if (!task) throw new Error('任务不存在');
  if (task.current_status !== 'FAILED') throw new Error('只有失败状态的任务可以重试');

  await promisifyDb('run',
    'UPDATE failure_records SET retry_count = retry_count + 1 WHERE task_id = ? AND resolved = 0',
    [taskId]
  );

  await updateTaskStatus(taskId, 'RUNNING', '任务重试');
  return getTaskById(taskId);
}

function getTaskById(taskId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function addNotification(taskId, channel, recipient, content) {
  const result = await promisifyDb('run',
    `INSERT INTO notification_records (task_id, channel, recipient, content) 
     VALUES (?, ?, ?, ?)`,
    [taskId, channel, recipient, content]
  );
  return result.lastId;
}

async function markNotificationSent(notificationId) {
  await promisifyDb('run',
    `UPDATE notification_records SET sent = 1, sent_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [notificationId]
  );
}

function getTaskDetail(taskId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, task) => {
      if (err) return reject(err);
      if (!task) return resolve(null);

      db.all('SELECT * FROM status_events WHERE task_id = ? ORDER BY created_at DESC', 
        [taskId], (err, events) => {
          if (err) return reject(err);

          db.all('SELECT * FROM progress_snapshots WHERE task_id = ? ORDER BY created_at DESC',
            [taskId], (err, snapshots) => {
              if (err) return reject(err);

              db.all('SELECT * FROM failure_records WHERE task_id = ? ORDER BY created_at DESC',
                [taskId], (err, failures) => {
                  if (err) return reject(err);

                  db.all('SELECT * FROM notification_records WHERE task_id = ? ORDER BY created_at DESC',
                    [taskId], (err, notifications) => {
                      if (err) return reject(err);

                      resolve({ ...task, events, snapshots, failures, notifications });
                    });
                });
            });
        });
    });
  });
}

function listTasks(filters = {}, page = 1, pageSize = 20) {
  return new Promise((resolve, reject) => {
    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params = [];

    if (filters.task_type) {
      sql += ' AND task_type = ?';
      params.push(filters.task_type);
    }
    if (filters.current_status) {
      sql += ' AND current_status = ?';
      params.push(filters.current_status);
    }
    if (filters.business_no) {
      sql += ' AND business_no LIKE ?';
      params.push(`%${filters.business_no}%`);
    }

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    db.get(countSql, params, (err, countResult) => {
      if (err) return reject(err);

      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(pageSize, (page - 1) * pageSize);

      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve({
          list: rows,
          total: countResult.total,
          page,
          pageSize
        });
      });
    });
  });
}

async function bulkCreateTasks(tasks) {
  const results = [];
  for (const task of tasks) {
    try {
      const result = await createTask(task.task_type, task.business_no, task.total_count);
      results.push({ ...task, ...result, success: true });
    } catch (error) {
      results.push({ ...task, success: false, error: error.message });
    }
  }
  return results;
}

function getAllTasksForExport(filters = {}) {
  return new Promise((resolve, reject) => {
    let sql = `SELECT t.*, 
      (SELECT COUNT(*) FROM status_events WHERE task_id = t.id) as event_count,
      (SELECT COUNT(*) FROM failure_records WHERE task_id = t.id) as failure_count
      FROM tasks t WHERE 1=1`;
    const params = [];

    if (filters.task_type) {
      sql += ' AND t.task_type = ?';
      params.push(filters.task_type);
    }
    if (filters.current_status) {
      sql += ' AND t.current_status = ?';
      params.push(filters.current_status);
    }

    sql += ' ORDER BY t.created_at DESC';
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  createTask,
  updateTaskStatus,
  addProgressSnapshot,
  recordFailure,
  retryTask,
  getTaskById,
  getTaskDetail,
  listTasks,
  bulkCreateTasks,
  getAllTasksForExport,
  addStatusEvent,
  addNotification,
  markNotificationSent
};
