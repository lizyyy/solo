const { run, get, all } = require('../database/db');
const { v4: uuidv4 } = require('uuid');

async function getAllHosts() {
  return await all('SELECT * FROM hosts ORDER BY name');
}

async function getHostById(id) {
  return await get('SELECT * FROM hosts WHERE id = ?', [id]);
}

async function createHost(name, department) {
  const id = uuidv4();
  await run('INSERT INTO hosts (id, name, department) VALUES (?, ?, ?)', [id, name, department]);
  return await getHostById(id);
}

async function getAllSchedules(filter = {}) {
  let query = `
    SELECT hs.*, h.name as host_name, h.department
    FROM host_schedules hs
    LEFT JOIN hosts h ON hs.host_id = h.id
    WHERE 1=1
  `;
  const params = [];
  
  if (filter.host_id) {
    query += ' AND hs.host_id = ?';
    params.push(filter.host_id);
  }
  if (filter.status) {
    query += ' AND hs.status = ?';
    params.push(filter.status);
  }
  if (filter.start_date) {
    query += ' AND hs.schedule_date >= ?';
    params.push(filter.start_date);
  }
  if (filter.end_date) {
    query += ' AND hs.schedule_date <= ?';
    params.push(filter.end_date);
  }
  
  query += ' ORDER BY hs.schedule_date DESC';
  
  return await all(query, params);
}

async function getScheduleById(id) {
  return await get(`
    SELECT hs.*, h.name as host_name, h.department
    FROM host_schedules hs
    LEFT JOIN hosts h ON hs.host_id = h.id
    WHERE hs.id = ?
  `, [id]);
}

async function createSchedule(data) {
  const id = uuidv4();
  await run(`
    INSERT INTO host_schedules 
    (id, host_id, schedule_date, start_time, end_time, description, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    data.host_id,
    data.schedule_date,
    data.start_time || null,
    data.end_time || null,
    data.description || null,
    data.status || 'active'
  ]);
  
  await saveScheduleVersion(id, null, '创建', data.created_by || 'system');
  
  return await getScheduleById(id);
}

async function updateSchedule(id, data, updatedBy = 'system') {
  const current = await getScheduleById(id);
  if (!current) return null;
  
  const newData = {
    host_id: data.host_id || current.host_id,
    schedule_date: data.schedule_date || current.schedule_date,
    start_time: data.start_time !== undefined ? data.start_time : current.start_time,
    end_time: data.end_time !== undefined ? data.end_time : current.end_time,
    description: data.description !== undefined ? data.description : current.description,
    status: data.status || current.status
  };
  
  await run(`
    UPDATE host_schedules 
    SET host_id = ?, schedule_date = ?, start_time = ?, end_time = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    newData.host_id,
    newData.schedule_date,
    newData.start_time,
    newData.end_time,
    newData.description,
    newData.status,
    id
  ]);
  
  await saveScheduleVersion(id, current, data.change_reason || '修改', updatedBy);
  
  return await getScheduleById(id);
}

async function saveScheduleVersion(scheduleId, oldData, changeReason, createdBy) {
  const id = uuidv4();
  
  if (oldData) {
    await run(`
      INSERT INTO host_schedule_versions 
      (id, schedule_id, host_id, schedule_date, start_time, end_time, description, status, change_reason, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      scheduleId,
      oldData.host_id,
      oldData.schedule_date,
      oldData.start_time,
      oldData.end_time,
      oldData.description,
      oldData.status,
      changeReason,
      createdBy
    ]);
  } else {
    const current = await getScheduleById(scheduleId);
    await run(`
      INSERT INTO host_schedule_versions 
      (id, schedule_id, host_id, schedule_date, start_time, end_time, description, status, change_reason, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      scheduleId,
      current.host_id,
      current.schedule_date,
      current.start_time,
      current.end_time,
      current.description,
      current.status,
      changeReason,
      createdBy
    ]);
  }
}

async function getScheduleVersions(scheduleId) {
  return await all(`
    SELECT hsv.*, h.name as host_name
    FROM host_schedule_versions hsv
    LEFT JOIN hosts h ON hsv.host_id = h.id
    WHERE hsv.schedule_id = ?
    ORDER BY hsv.created_at DESC
  `, [scheduleId]);
}

module.exports = {
  getAllHosts,
  getHostById,
  createHost,
  getAllSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  getScheduleVersions
};
