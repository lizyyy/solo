const { db } = require('./schema');
const { v4: uuidv4 } = require('uuid');

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

const UserDAO = {
  async create(user) {
    const id = uuidv4();
    const sql = `INSERT INTO users (id, username, name, role, department) VALUES (?, ?, ?, ?, ?)`;
    await runQuery(sql, [id, user.username, user.name, user.role, user.department]);
    return { id, ...user };
  },

  async getById(id) {
    return getQuery(`SELECT * FROM users WHERE id = ?`, [id]);
  },

  async getByUsername(username) {
    return getQuery(`SELECT * FROM users WHERE username = ?`, [username]);
  },

  async getAll() {
    return allQuery(`SELECT * FROM users ORDER BY created_at DESC`);
  }
};

const OperationEventDAO = {
  async create(event) {
    const id = uuidv4();
    const sql = `INSERT INTO operation_events 
      (id, event_type, module, operator_id, operator_name, ip_address, details, status, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await runQuery(sql, [
      id, event.event_type, event.module, event.operator_id, 
      event.operator_name, event.ip_address, event.details, 
      event.status || 'success', event.created_at || new Date().toISOString()
    ]);
    return { id, ...event };
  },

  async getById(id) {
    return getQuery(`SELECT * FROM operation_events WHERE id = ?`, [id]);
  },

  async query(filters = {}, limit = 100, offset = 0) {
    let sql = `SELECT * FROM operation_events WHERE 1=1`;
    const params = [];

    if (filters.operator_ids && filters.operator_ids.length > 0) {
      sql += ` AND operator_id IN (${filters.operator_ids.map(() => '?').join(',')})`;
      params.push(...filters.operator_ids);
    }
    if (filters.start_time) {
      sql += ` AND created_at >= ?`;
      params.push(filters.start_time);
    }
    if (filters.end_time) {
      sql += ` AND created_at <= ?`;
      params.push(filters.end_time);
    }
    if (filters.event_types && filters.event_types.length > 0) {
      sql += ` AND event_type IN (${filters.event_types.map(() => '?').join(',')})`;
      params.push(...filters.event_types);
    }
    if (filters.modules && filters.modules.length > 0) {
      sql += ` AND module IN (${filters.modules.map(() => '?').join(',')})`;
      params.push(...filters.modules);
    }
    if (filters.statuses && filters.statuses.length > 0) {
      sql += ` AND status IN (${filters.statuses.map(() => '?').join(',')})`;
      params.push(...filters.statuses);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return allQuery(sql, params);
  },

  async count(filters = {}) {
    let sql = `SELECT COUNT(*) as total FROM operation_events WHERE 1=1`;
    const params = [];

    if (filters.operator_ids && filters.operator_ids.length > 0) {
      sql += ` AND operator_id IN (${filters.operator_ids.map(() => '?').join(',')})`;
      params.push(...filters.operator_ids);
    }
    if (filters.start_time) {
      sql += ` AND created_at >= ?`;
      params.push(filters.start_time);
    }
    if (filters.end_time) {
      sql += ` AND created_at <= ?`;
      params.push(filters.end_time);
    }
    if (filters.event_types && filters.event_types.length > 0) {
      sql += ` AND event_type IN (${filters.event_types.map(() => '?').join(',')})`;
      params.push(...filters.event_types);
    }
    if (filters.modules && filters.modules.length > 0) {
      sql += ` AND module IN (${filters.modules.map(() => '?').join(',')})`;
      params.push(...filters.modules);
    }
    if (filters.statuses && filters.statuses.length > 0) {
      sql += ` AND status IN (${filters.statuses.map(() => '?').join(',')})`;
      params.push(...filters.statuses);
    }

    const result = await getQuery(sql, params);
    return result.total;
  }
};

const ExportTaskDAO = {
  async create(task) {
    const id = uuidv4();
    const sql = `INSERT INTO export_tasks 
      (id, task_name, creator_id, creator_name, filter_snapshot, expire_at) 
      VALUES (?, ?, ?, ?, ?, ?)`;
    await runQuery(sql, [
      id, task.task_name, task.creator_id, task.creator_name,
      JSON.stringify(task.filter_snapshot), task.expire_at
    ]);
    return { id, ...task };
  },

  async getById(id) {
    const row = await getQuery(`SELECT * FROM export_tasks WHERE id = ?`, [id]);
    if (row) {
      row.filter_snapshot = JSON.parse(row.filter_snapshot);
    }
    return row;
  },

  async getAll(limit = 50, offset = 0) {
    const rows = await allQuery(
      `SELECT * FROM export_tasks ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return rows.map(row => ({
      ...row,
      filter_snapshot: JSON.parse(row.filter_snapshot)
    }));
  },

  async updateStatus(id, status, errorMessage = null) {
    let sql = `UPDATE export_tasks SET status = ?, updated_at = CURRENT_TIMESTAMP`;
    const params = [status];
    
    if (errorMessage) {
      sql += `, error_message = ?`;
      params.push(errorMessage);
    }
    sql += ` WHERE id = ?`;
    params.push(id);
    
    return runQuery(sql, params);
  },

  async updateFileInfo(id, filePath, fileName, fileSize, exportedCount, totalCount) {
    return runQuery(
      `UPDATE export_tasks SET file_path = ?, file_name = ?, file_size = ?, 
       exported_count = ?, total_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [filePath, fileName, fileSize, exportedCount, totalCount, id]
    );
  },

  async getByCreator(creatorId, limit = 50) {
    const rows = await allQuery(
      `SELECT * FROM export_tasks WHERE creator_id = ? ORDER BY created_at DESC LIMIT ?`,
      [creatorId, limit]
    );
    return rows.map(row => ({
      ...row,
      filter_snapshot: JSON.parse(row.filter_snapshot)
    }));
  },

  async checkDuplicate(creatorId, filterSnapshot) {
    const filterStr = JSON.stringify(filterSnapshot);
    return getQuery(
      `SELECT * FROM export_tasks WHERE creator_id = ? AND filter_snapshot = ? AND status IN ('pending', 'processing') LIMIT 1`,
      [creatorId, filterStr]
    );
  }
};

const TaskStatusHistoryDAO = {
  async create(history) {
    const id = uuidv4();
    const sql = `INSERT INTO task_status_history 
      (id, task_id, from_status, to_status, operator_id, operator_name, reason) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`;
    await runQuery(sql, [
      id, history.task_id, history.from_status, history.to_status,
      history.operator_id, history.operator_name, history.reason]);
    return { id, ...history };
  },

  async getByTaskId(taskId) {
    return allQuery(
      `SELECT * FROM task_status_history WHERE task_id = ? ORDER BY created_at ASC`,
      [taskId]
    );
  }
};

const DownloadPermissionDAO = {
  async create(permission) {
    const id = uuidv4();
    const sql = `INSERT INTO download_permissions 
      (id, task_id, user_id, granted_by, expires_at) 
      VALUES (?, ?, ?, ?, ?)`;
    await runQuery(sql, [
      id, permission.task_id, permission.user_id, permission.granted_by, permission.expires_at
    ]);
    return { id, ...permission };
  },

  async checkPermission(taskId, userId) {
    return getQuery(
      `SELECT * FROM download_permissions WHERE task_id = ? AND user_id = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [taskId, userId]
    );
  }
};

const EvidenceRecordDAO = {
  async create(record) {
    const id = uuidv4();
    const sql = `INSERT INTO evidence_records 
      (id, task_id, action_type, operator_id, operator_name, details) 
      VALUES (?, ?, ?, ?, ?, ?)`;
    await runQuery(sql, [
      id, record.task_id, record.action_type, record.operator_id,
      record.operator_name, JSON.stringify(record.details)
    ]);
    return { id, ...record };
  },

  async getByTaskId(taskId) {
    const rows = await allQuery(
      `SELECT * FROM evidence_records WHERE task_id = ? ORDER BY created_at ASC`,
      [taskId]
    );
    return rows.map(row => ({
      ...row,
      details: row.details ? JSON.parse(row.details) : null
    }));
  }
};

module.exports = {
  UserDAO,
  OperationEventDAO,
  ExportTaskDAO,
  TaskStatusHistoryDAO,
  DownloadPermissionDAO,
  EvidenceRecordDAO
};
