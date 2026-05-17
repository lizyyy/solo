const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('./database');
const { STATUS, STATUS_TRANSITIONS, STATUS_LABELS } = require('./constants');

function now() {
  return Date.now();
}

function validateStatusTransition(fromStatus, toStatus) {
  if (!fromStatus) return true;
  const allowedTransitions = STATUS_TRANSITIONS[fromStatus] || [];
  return allowedTransitions.includes(toStatus);
}

async function addStatusHistory(recordId, fromStatus, toStatus, operator = 'system', remark = '') {
  const historyId = uuidv4();
  await run(
    'INSERT INTO status_history (id, record_id, from_status, to_status, operator, remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [historyId, recordId, fromStatus, toStatus, operator, remark, now()]
  );
}

async function checkConflict(taskPackageId, annotatorId) {
  const taskPackage = await get('SELECT * FROM task_packages WHERE id = ?', [taskPackageId]);
  if (!taskPackage) return null;

  if (taskPackage.original_annotator_id === annotatorId) {
    return {
      type: 'same_annotator',
      message: '该任务包拆分后不能重复发给原标注员',
      details: {
        task_package_id: taskPackageId,
        original_annotator_id: taskPackage.original_annotator_id,
        requested_annotator_id: annotatorId
      }
    };
  }

  const existingRecords = await all(
    'SELECT * FROM rework_records WHERE task_package_id = ? AND annotator_id = ? AND status != ?',
    [taskPackageId, annotatorId, STATUS.ACCEPTED]
  );

  if (existingRecords.length > 0) {
    return {
      type: 'duplicate_assignment',
      message: '该标注员已有未完成的同任务包返工记录',
      details: {
        task_package_id: taskPackageId,
        annotator_id: annotatorId,
        existing_records: existingRecords.map(r => ({ id: r.id, status: r.status }))
      }
    };
  }

  return null;
}

const projectService = {
  async list() {
    return await all('SELECT * FROM projects ORDER BY created_at DESC');
  },

  async get(id) {
    return await get('SELECT * FROM projects WHERE id = ?', [id]);
  },

  async create(data) {
    const id = uuidv4();
    const timestamp = now();
    await run(
      'INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [id, data.name, timestamp, timestamp]
    );
    return this.get(id);
  }
};

const annotatorService = {
  async list() {
    return await all('SELECT * FROM annotators ORDER BY created_at DESC');
  },

  async get(id) {
    return await get('SELECT * FROM annotators WHERE id = ?', [id]);
  },

  async create(data) {
    const id = uuidv4();
    await run(
      'INSERT INTO annotators (id, name, email, created_at) VALUES (?, ?, ?, ?)',
      [id, data.name, data.email || null, now()]
    );
    return this.get(id);
  }
};

const taskPackageService = {
  async list(filters = {}) {
    let sql = 'SELECT * FROM task_packages WHERE 1=1';
    const params = [];

    if (filters.project_id) {
      sql += ' AND project_id = ?';
      params.push(filters.project_id);
    }
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY created_at DESC';
    return await all(sql, params);
  },

  async get(id) {
    return await get('SELECT * FROM task_packages WHERE id = ?', [id]);
  },

  async create(data) {
    const id = uuidv4();
    const timestamp = now();
    await run(
      'INSERT INTO task_packages (id, project_id, name, status, original_annotator_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, data.project_id, data.name, data.status || STATUS.PENDING_ASSIGN, data.original_annotator_id || null, timestamp, timestamp]
    );
    return this.get(id);
  },

  async updateStatus(id, newStatus, operator = 'system', remark = '') {
    const pkg = await this.get(id);
    if (!pkg) throw new Error('任务包不存在');

    if (!validateStatusTransition(pkg.status, newStatus)) {
      throw new Error(`不允许从 ${STATUS_LABELS[pkg.status]} 流转到 ${STATUS_LABELS[newStatus]}`);
    }

    await run('UPDATE task_packages SET status = ?, updated_at = ? WHERE id = ?', [newStatus, now(), id]);
    await addStatusHistory(id, pkg.status, newStatus, operator, remark);
    return this.get(id);
  }
};

const reworkRecordService = {
  async list(filters = {}) {
    let sql = `
      SELECT r.*, 
             p.name as project_name,
             tp.name as task_package_name,
             a.name as annotator_name
      FROM rework_records r
      LEFT JOIN projects p ON r.project_id = p.id
      LEFT JOIN task_packages tp ON r.task_package_id = tp.id
      LEFT JOIN annotators a ON r.annotator_id = a.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.project_id) {
      sql += ' AND r.project_id = ?';
      params.push(filters.project_id);
    }
    if (filters.status) {
      sql += ' AND r.status = ?';
      params.push(filters.status);
    }
    if (filters.annotator_id) {
      sql += ' AND r.annotator_id = ?';
      params.push(filters.annotator_id);
    }

    sql += ' ORDER BY r.created_at DESC';
    return await all(sql, params);
  },

  async get(id) {
    return await get(`
      SELECT r.*, 
             p.name as project_name,
             tp.name as task_package_name,
             a.name as annotator_name
      FROM rework_records r
      LEFT JOIN projects p ON r.project_id = p.id
      LEFT JOIN task_packages tp ON r.task_package_id = tp.id
      LEFT JOIN annotators a ON r.annotator_id = a.id
      WHERE r.id = ?
    `, [id]);
  },

  async getHistory(recordId) {
    return await all('SELECT * FROM status_history WHERE record_id = ? ORDER BY created_at ASC', [recordId]);
  },

  async create(data) {
    const id = uuidv4();
    const timestamp = now();
    const initialStatus = data.status || STATUS.PENDING_ASSIGN;

    const conflict = await checkConflict(data.task_package_id, data.annotator_id);
    
    let finalStatus = initialStatus;
    let conflictInfo = null;

    if (conflict) {
      finalStatus = STATUS.PENDING_MANUAL;
      conflictInfo = JSON.stringify(conflict);
    }

    await run(
      'INSERT INTO rework_records (id, task_package_id, project_id, annotator_id, reason, status, conflict_info, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, data.task_package_id, data.project_id, data.annotator_id, data.reason, finalStatus, conflictInfo, timestamp, timestamp]
    );

    await addStatusHistory(id, null, finalStatus, data.operator || 'system', conflict ? conflict.message : '创建返工记录');

    const result = await this.get(id);
    if (conflict) {
      result.conflict_detected = true;
      result.conflict = conflict;
    }

    return result;
  },

  async updateStatus(id, newStatus, operator = 'system', remark = '') {
    const record = await this.get(id);
    if (!record) throw new Error('返工记录不存在');

    if (!validateStatusTransition(record.status, newStatus)) {
      throw new Error(`不允许从 ${STATUS_LABELS[record.status]} 流转到 ${STATUS_LABELS[newStatus]}`);
    }

    await run('UPDATE rework_records SET status = ?, updated_at = ? WHERE id = ?', [newStatus, now(), id]);
    await addStatusHistory(id, record.status, newStatus, operator, remark);
    return this.get(id);
  },

  async export(filters = {}) {
    const records = await this.list(filters);
    return records.map(r => ({
      id: r.id,
      project_name: r.project_name,
      task_package_name: r.task_package_name,
      annotator_name: r.annotator_name,
      reason: r.reason,
      status: STATUS_LABELS[r.status] || r.status,
      has_conflict: !!r.conflict_info,
      created_at: new Date(r.created_at).toISOString(),
      updated_at: new Date(r.updated_at).toISOString()
    }));
  }
};

module.exports = {
  projectService,
  annotatorService,
  taskPackageService,
  reworkRecordService,
  validateStatusTransition,
  checkConflict
};
