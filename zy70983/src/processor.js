const crypto = require('crypto');
const { getDb } = require('./database');

const REQUIRED_FIELDS = ['record_no', 'streetlight_id'];
const TASK_STATUSES = ['processing', 'failed', 'manual_confirm', 'exported'];

function calculateMaterialHash(material) {
  const sortedData = JSON.stringify(material, Object.keys(material).sort());
  return crypto.createHash('sha256').update(sortedData).digest('hex');
}

function findDuplicateTask(hash) {
  const db = getDb();
  return db.prepare('SELECT * FROM tasks WHERE material_hash = ?').get(hash);
}

function generateTaskId() {
  return 'T' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function validateRecord(record, index, allRecords) {
  const errors = [];
  
  for (const field of REQUIRED_FIELDS) {
    if (!record[field] || String(record[field]).trim() === '') {
      errors.push({
        record_index: index,
        error_type: 'missing_field',
        error_field: field,
        error_message: `缺少必填字段: ${field}`,
        raw_data: JSON.stringify(record)
      });
    }
  }

  if (record.alarm_time && record.patrol_time) {
    if (record.patrol_time < record.alarm_time) {
      errors.push({
        record_index: index,
        error_type: 'time_conflict',
        error_field: 'patrol_time',
        error_message: '巡查时间不能早于告警时间',
        raw_data: JSON.stringify(record)
      });
    }
  }

  if (record.patrol_time && record.repair_time) {
    if (record.repair_time < record.patrol_time) {
      errors.push({
        record_index: index,
        error_type: 'time_conflict',
        error_field: 'repair_time',
        error_message: '维修时间不能早于巡查时间',
        raw_data: JSON.stringify(record)
      });
    }
  }

  if (record.record_no) {
    const duplicateInBatch = allRecords.filter((r, i) => i !== index && r.record_no === record.record_no);
    if (duplicateInBatch.length > 0) {
      errors.push({
        record_index: index,
        error_type: 'duplicate_no',
        error_field: 'record_no',
        error_message: `记录编号在本批次中重复: ${record.record_no}`,
        raw_data: JSON.stringify(record)
      });
    }
  }

  return errors;
}

function checkMapLocations(record) {
  const result = {
    alarm_on_map: record.alarm_location ? 1 : 0,
    patrol_on_map: record.patrol_location ? 1 : 0,
    repair_on_map: record.repair_location ? 1 : 0
  };
  return result;
}

function processMaterial(taskId, material) {
  const db = getDb();
  const records = material.records || [];
  const allErrors = [];
  const validRecords = [];

  records.forEach((record, index) => {
    const errors = validateRecord(record, index, records);
    if (errors.length > 0) {
      allErrors.push(...errors);
    } else {
      const mapLocations = checkMapLocations(record);
      validRecords.push({
        ...record,
        ...mapLocations,
        index
      });
    }
  });

  const insertRecord = db.prepare(`
    INSERT INTO records (
      task_id, record_no, streetlight_id, alarm_time, alarm_level, alarm_type,
      patrol_time, patrol_person, patrol_issue, repair_time, repair_person, repair_result,
      alarm_on_map, patrol_on_map, repair_on_map, is_valid, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertError = db.prepare(`
    INSERT INTO errors (task_id, record_index, error_type, error_field, error_message, raw_data, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const now = Date.now();

  const insertMany = db.transaction(() => {
    for (const rec of validRecords) {
      insertRecord.run(
        taskId, rec.record_no, rec.streetlight_id,
        rec.alarm_time || null, rec.alarm_level || null, rec.alarm_type || null,
        rec.patrol_time || null, rec.patrol_person || null, rec.patrol_issue || null,
        rec.repair_time || null, rec.repair_person || null, rec.repair_result || null,
        rec.alarm_on_map, rec.patrol_on_map, rec.repair_on_map, 1, now
      );
    }

    for (const err of allErrors) {
      insertError.run(
        taskId, err.record_index, err.error_type,
        err.error_field, err.error_message, err.raw_data, now
      );
    }
  });

  insertMany();

  const status = allErrors.length > 0 ? 'manual_confirm' : 'processing';
  
  db.prepare(`
    UPDATE tasks 
    SET status = ?, total_records = ?, valid_records = ?, error_records = ?
    WHERE id = ?
  `).run(status, records.length, validRecords.length, allErrors.length, taskId);

  return {
    taskId,
    status,
    total_records: records.length,
    valid_records: validRecords.length,
    error_records: allErrors.length
  };
}

function createTask(material, handlerId = 'h001') {
  const db = getDb();
  const hash = calculateMaterialHash(material);
  
  const existingTask = findDuplicateTask(hash);
  if (existingTask) {
    return {
      is_duplicate: true,
      task: existingTask
    };
  }

  const taskId = generateTaskId();
  const now = Date.now();

  db.prepare(`
    INSERT INTO tasks (id, material_hash, status, submit_time, last_handler, raw_material)
    VALUES (?, ?, 'processing', ?, ?, ?)
  `).run(taskId, hash, now, handlerId, JSON.stringify(material));

  const result = processMaterial(taskId, material);

  return {
    is_duplicate: false,
    task: {
      id: taskId,
      ...result
    }
  };
}

function getTaskById(taskId) {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) return null;

  const records = db.prepare('SELECT * FROM records WHERE task_id = ?').all(taskId);
  const errors = db.prepare('SELECT * FROM errors WHERE task_id = ?').all(taskId);
  const handler = task.last_handler 
    ? db.prepare('SELECT name, department FROM handlers WHERE id = ?').get(task.last_handler)
    : null;

  return {
    ...task,
    records,
    errors,
    handler
  };
}

function getTaskList(status = null, limit = 50, offset = 0) {
  const db = getDb();
  let query = 'SELECT * FROM tasks';
  let params = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY submit_time DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const tasks = db.prepare(query).all(...params);
  
  return tasks.map(task => ({
    id: task.id,
    status: task.status,
    submit_time: task.submit_time,
    total_records: task.total_records,
    valid_records: task.valid_records,
    error_records: task.error_records,
    export_time: task.export_time
  }));
}

function getStatistics() {
  const db = getDb();
  const result = db.prepare(`
    SELECT 
      COUNT(*) as total_tasks,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'manual_confirm' THEN 1 ELSE 0 END) as manual_confirm,
      SUM(CASE WHEN status = 'exported' THEN 1 ELSE 0 END) as exported,
      SUM(total_records) as total_records,
      SUM(valid_records) as valid_records,
      SUM(error_records) as error_records
    FROM tasks
  `).get();

  return result;
}

function exportTask(taskId, handlerId = 'h001') {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  
  if (!task) {
    throw new Error('任务不存在');
  }

  const records = db.prepare(`
    SELECT 
      r.*,
      h.name as handler_name,
      h.department as handler_department
    FROM records r
    LEFT JOIN handlers h ON h.id = ?
    WHERE r.task_id = ? AND r.is_valid = 1
  `).all(handlerId, taskId);

  const exportData = records.map(rec => ({
    record_no: rec.record_no,
    streetlight_id: rec.streetlight_id,
    alarm_info: {
      time: rec.alarm_time,
      level: rec.alarm_level,
      type: rec.alarm_type,
      on_map: rec.alarm_on_map === 1
    },
    patrol_info: {
      time: rec.patrol_time,
      person: rec.patrol_person,
      issue: rec.patrol_issue,
      on_map: rec.patrol_on_map === 1
    },
    repair_info: {
      time: rec.repair_time,
      person: rec.repair_person,
      result: rec.repair_result,
      on_map: rec.repair_on_map === 1
    },
    map_consistent: (rec.alarm_on_map === rec.patrol_on_map) && (rec.patrol_on_map === rec.repair_on_map),
    last_handler: {
      id: handlerId,
      name: rec.handler_name,
      department: rec.handler_department
    }
  }));

  const now = Date.now();
  db.prepare(`
    UPDATE tasks SET status = 'exported', export_time = ?, last_handler = ? WHERE id = ?
  `).run(now, handlerId, taskId);

  return {
    task_id: taskId,
    export_time: now,
    total_count: exportData.length,
    data: exportData
  };
}

function updateTaskStatus(taskId, status, handlerId = 'h001') {
  const db = getDb();
  
  if (!TASK_STATUSES.includes(status)) {
    throw new Error('无效的状态值');
  }

  const result = db.prepare(`
    UPDATE tasks SET status = ?, last_handler = ? WHERE id = ?
  `).run(status, handlerId, taskId);

  return result.changes > 0;
}

module.exports = {
  calculateMaterialHash,
  findDuplicateTask,
  createTask,
  getTaskById,
  getTaskList,
  getStatistics,
  exportTask,
  updateTaskStatus,
  TASK_STATUSES
};