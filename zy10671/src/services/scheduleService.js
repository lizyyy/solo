const { run, get, all } = require('../database');

const VALID_STATUSES = ['pending', 'conflict_pending', 'online', 'offline'];

const detectConflicts = async (channelId, startTime, endTime, excludeScheduleId = null) => {
  let sql = `
    SELECT s.id, t.name as topic_name, s.start_time, s.end_time, s.status, s.operator
    FROM schedules s
    JOIN topics t ON s.topic_id = t.id
    WHERE s.channel_id = ?
      AND s.status NOT IN ('offline')
      AND (
        (s.start_time <= ? AND s.end_time >= ?)
        OR (s.start_time >= ? AND s.start_time <= ?)
        OR (s.end_time >= ? AND s.end_time <= ?)
        OR (s.start_time >= ? AND s.end_time <= ?)
      )
  `;
  
  const params = [channelId, startTime, endTime, startTime, endTime, startTime, endTime, startTime, endTime];
  
  if (excludeScheduleId) {
    sql += ' AND s.id != ?';
    params.push(excludeScheduleId);
  }
  
  return await all(sql, params);
};

const validateSchedule = (data, rowIndex = null) => {
  const errors = [];
  
  if (!data.topic_id && !data.topic_code) {
    errors.push('专题ID或专题编码不能为空');
  }
  
  if (!data.channel_id && !data.channel_code) {
    errors.push('频道ID或频道编码不能为空');
  }
  
  if (!data.start_time) {
    errors.push('开始时间不能为空');
  } else {
    const startTime = new Date(data.start_time);
    if (isNaN(startTime.getTime())) {
      errors.push('开始时间格式无效');
    }
  }
  
  if (!data.end_time) {
    errors.push('结束时间不能为空');
  } else {
    const endTime = new Date(data.end_time);
    if (isNaN(endTime.getTime())) {
      errors.push('结束时间格式无效');
    }
  }
  
  if (data.start_time && data.end_time) {
    const startTime = new Date(data.start_time);
    const endTime = new Date(data.end_time);
    if (startTime >= endTime) {
      errors.push('开始时间必须早于结束时间');
    }
  }
  
  if (!data.operator) {
    errors.push('运营人不能为空');
  }
  
  if (data.status && !VALID_STATUSES.includes(data.status)) {
    errors.push(`状态值无效，有效值为: ${VALID_STATUSES.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    rowIndex
  };
};

const resolveIds = async (data) => {
  if (data.topic_code && !data.topic_id) {
    const topic = await get('SELECT id FROM topics WHERE code = ?', [data.topic_code]);
    if (topic) data.topic_id = topic.id;
  }
  
  if (data.channel_code && !data.channel_id) {
    const channel = await get('SELECT id FROM channels WHERE code = ?', [data.channel_code]);
    if (channel) data.channel_id = channel.id;
  }
  
  return data;
};

const createSchedule = async (data) => {
  data = await resolveIds(data);
  
  const validation = validateSchedule(data);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }
  
  const conflicts = await detectConflicts(data.channel_id, data.start_time, data.end_time);
  
  let status = data.status || 'pending';
  let conflictInfo = null;
  
  if (conflicts.length > 0) {
    status = 'conflict_pending';
    conflictInfo = JSON.stringify({
      conflicts: conflicts.map(c => ({
        schedule_id: c.id,
        topic_name: c.topic_name,
        start_time: c.start_time,
        end_time: c.end_time,
        operator: c.operator
      }))
    });
  }
  
  const result = await run(`
    INSERT INTO schedules (topic_id, channel_id, start_time, end_time, status, operator, remark, conflict_info)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    data.topic_id,
    data.channel_id,
    data.start_time,
    data.end_time,
    status,
    data.operator,
    data.remark || null,
    conflictInfo
  ]);
  
  const scheduleId = result.lastID;
  
  await run(`
    INSERT INTO schedule_history (schedule_id, action, old_status, new_status, operator, remark, change_details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    scheduleId,
    conflicts.length > 0 ? 'create_with_conflict' : 'create',
    null,
    status,
    data.operator,
    conflicts.length > 0 ? '创建排期，检测到冲突' : '创建排期',
    JSON.stringify(data)
  ]);
  
  return {
    success: true,
    id: scheduleId,
    status,
    hasConflict: conflicts.length > 0,
    conflicts
  };
};

const updateSchedule = async (id, data) => {
  const existing = await get('SELECT * FROM schedules WHERE id = ?', [id]);
  if (!existing) {
    return { success: false, error: '排期不存在' };
  }
  
  if (data.topic_code || data.channel_code) {
    data = await resolveIds(data);
  }
  
  const channelId = data.channel_id || existing.channel_id;
  const startTime = data.start_time || existing.start_time;
  const endTime = data.end_time || existing.end_time;
  
  const validation = validateSchedule({
    ...existing,
    ...data
  });
  
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }
  
  const conflicts = await detectConflicts(channelId, startTime, endTime, id);
  
  let status = data.status || existing.status;
  let conflictInfo = existing.conflict_info;
  
  if (conflicts.length > 0 && status !== 'conflict_pending') {
    status = 'conflict_pending';
    conflictInfo = JSON.stringify({
      conflicts: conflicts.map(c => ({
        schedule_id: c.id,
        topic_name: c.topic_name,
        start_time: c.start_time,
        end_time: c.end_time,
        operator: c.operator
      }))
    });
  } else if (conflicts.length === 0 && status === 'conflict_pending') {
    status = 'pending';
    conflictInfo = null;
  }
  
  await run(`
    UPDATE schedules 
    SET topic_id = COALESCE(?, topic_id),
        channel_id = COALESCE(?, channel_id),
        start_time = COALESCE(?, start_time),
        end_time = COALESCE(?, end_time),
        status = ?,
        operator = COALESCE(?, operator),
        remark = COALESCE(?, remark),
        conflict_info = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    data.topic_id || null,
    channelId,
    startTime,
    endTime,
    status,
    data.operator || null,
    data.remark !== undefined ? data.remark : null,
    conflictInfo,
    id
  ]);
  
  const changedFields = {};
  Object.keys(data).forEach(key => {
    if (data[key] !== existing[key]) {
      changedFields[key] = { from: existing[key], to: data[key] };
    }
  });
  
  await run(`
    INSERT INTO schedule_history (schedule_id, action, old_status, new_status, operator, remark, change_details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    'update',
    existing.status,
    status,
    data.operator || existing.operator,
    conflicts.length > 0 ? '更新排期，检测到冲突' : '更新排期',
    JSON.stringify(changedFields)
  ]);
  
  return {
    success: true,
    id,
    status,
    hasConflict: conflicts.length > 0,
    conflicts
  };
};

const batchImport = async (rows, operator) => {
  const results = [];
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const validation = validateSchedule(row, i);
    
    if (!validation.valid) {
      results.push({
        row_index: i,
        success: false,
        errors: validation.errors,
        data: row
      });
      continue;
    }
    
    const resolvedRow = await resolveIds(row);
    
    if (!resolvedRow.topic_id) {
      results.push({
        row_index: i,
        success: false,
        errors: [`专题编码 ${row.topic_code} 不存在`],
        data: row
      });
      continue;
    }
    
    if (!resolvedRow.channel_id) {
      results.push({
        row_index: i,
        success: false,
        errors: [`频道编码 ${row.channel_code} 不存在`],
        data: row
      });
      continue;
    }
    
    const createResult = await createSchedule({
      ...resolvedRow,
      operator: row.operator || operator
    });
    
    results.push({
      row_index: i,
      success: createResult.success,
      id: createResult.id,
      status: createResult.status,
      hasConflict: createResult.hasConflict,
      conflicts: createResult.conflicts,
      errors: createResult.errors,
      data: row
    });
  }
  
  return {
    total: rows.length,
    success: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    has_conflicts: results.filter(r => r.hasConflict).length,
    results
  };
};

const getScheduleList = async (filters = {}) => {
  let sql = `
    SELECT 
      s.id,
      t.code as topic_code,
      t.name as topic_name,
      t.content_type,
      c.code as channel_code,
      c.name as channel_name,
      s.start_time,
      s.end_time,
      s.status,
      s.operator,
      s.remark,
      s.conflict_info,
      s.created_at,
      s.updated_at
    FROM schedules s
    JOIN topics t ON s.topic_id = t.id
    JOIN channels c ON s.channel_id = c.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (filters.status) {
    sql += ' AND s.status = ?';
    params.push(filters.status);
  }
  
  if (filters.channel_id) {
    sql += ' AND s.channel_id = ?';
    params.push(filters.channel_id);
  }
  
  if (filters.operator) {
    sql += ' AND s.operator = ?';
    params.push(filters.operator);
  }
  
  if (filters.keyword) {
    sql += ' AND (t.name LIKE ? OR c.name LIKE ?)';
    params.push(`%${filters.keyword}%`, `%${filters.keyword}%`);
  }
  
  sql += ' ORDER BY s.created_at DESC';
  
  const list = await all(sql, params);
  
  return list.map(item => ({
    ...item,
    conflict_info: item.conflict_info ? JSON.parse(item.conflict_info) : null
  }));
};

const getScheduleDetail = async (id) => {
  const schedule = await get(`
    SELECT 
      s.id,
      t.id as topic_id,
      t.code as topic_code,
      t.name as topic_name,
      t.description as topic_description,
      t.cover_image,
      t.content_type,
      c.id as channel_id,
      c.code as channel_code,
      c.name as channel_name,
      c.description as channel_description,
      c.priority as channel_priority,
      s.start_time,
      s.end_time,
      s.status,
      s.operator,
      s.remark,
      s.conflict_info,
      s.created_at,
      s.updated_at
    FROM schedules s
    JOIN topics t ON s.topic_id = t.id
    JOIN channels c ON s.channel_id = c.id
    WHERE s.id = ?
  `, [id]);
  
  if (!schedule) return null;
  
  return {
    ...schedule,
    conflict_info: schedule.conflict_info ? JSON.parse(schedule.conflict_info) : null
  };
};

const getScheduleHistory = async (scheduleId) => {
  const history = await all(`
    SELECT 
      id,
      action,
      old_status,
      new_status,
      operator,
      remark,
      change_details,
      created_at
    FROM schedule_history
    WHERE schedule_id = ?
    ORDER BY created_at DESC
  `, [scheduleId]);
  
  return history.map(item => ({
    ...item,
    change_details: item.change_details ? JSON.parse(item.change_details) : null
  }));
};

const updateStatus = async (id, newStatus, operator, remark = '') => {
  const existing = await get('SELECT * FROM schedules WHERE id = ?', [id]);
  if (!existing) {
    return { success: false, error: '排期不存在' };
  }
  
  if (!VALID_STATUSES.includes(newStatus)) {
    return { success: false, error: `状态值无效，有效值为: ${VALID_STATUSES.join(', ')}` };
  }
  
  await run('UPDATE schedules SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, id]);
  
  await run(`
    INSERT INTO schedule_history (schedule_id, action, old_status, new_status, operator, remark, change_details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    'status_change',
    existing.status,
    newStatus,
    operator,
    remark,
    JSON.stringify({ field: 'status', from: existing.status, to: newStatus })
  ]);
  
  return { success: true, id, old_status: existing.status, new_status: newStatus };
};

const getChannels = async () => {
  return await all('SELECT * FROM channels ORDER BY priority DESC');
};

const getTopics = async () => {
  return await all('SELECT * FROM topics ORDER BY created_at DESC');
};

module.exports = {
  VALID_STATUSES,
  detectConflicts,
  validateSchedule,
  createSchedule,
  updateSchedule,
  batchImport,
  getScheduleList,
  getScheduleDetail,
  getScheduleHistory,
  updateStatus,
  getChannels,
  getTopics
};
