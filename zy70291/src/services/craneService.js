const { v4: uuidv4 } = require('uuid');
const { prepare } = require('../db');
const { CRANE_STATES } = require('../utils/status');
const { ValidationError, NotFoundError } = require('../utils/errors');

function createCrane(data) {
  if (!data.code || !data.name || !data.building_range) {
    throw new ValidationError('塔吊编号、名称和服务楼栋范围为必填项');
  }
  
  if (data.max_wind_speed != null && data.max_wind_speed < 0) {
    throw new ValidationError('最大允许风速不能为负数');
  }
  
  if (data.max_load != null && data.max_load <= 0) {
    throw new ValidationError('最大起重重量必须大于0');
  }
  
  const existing = prepare('SELECT id FROM cranes WHERE code = ?').get(data.code);
  if (existing) {
    throw new ValidationError(`塔吊编号 ${data.code} 已存在`);
  }
  
  const id = uuidv4();
  const now = new Date().toISOString();
  
  prepare(`
    INSERT INTO cranes (
      id, code, name, max_wind_speed, max_load, 
      building_range, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.code,
    data.name,
    data.max_wind_speed ?? 20.0,
    data.max_load ?? 10.0,
    data.building_range,
    CRANE_STATES.ACTIVE,
    now,
    now
  );
  
  return getCraneById(id);
}

function getCraneById(id) {
  const crane = prepare('SELECT * FROM cranes WHERE id = ?').get(id);
  
  if (!crane) {
    throw new NotFoundError(`塔吊 ${id} 不存在`, 'crane');
  }
  
  return crane;
}

function getCraneByCode(code) {
  const crane = prepare('SELECT * FROM cranes WHERE code = ?').get(code);
  
  if (!crane) {
    throw new NotFoundError(`塔吊 ${code} 不存在`, 'crane');
  }
  
  return crane;
}

function listCranes(filters = {}) {
  let query = 'SELECT * FROM cranes WHERE 1=1';
  const params = [];
  
  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }
  
  query += ' ORDER BY created_at DESC';
  
  return prepare(query).all(...params);
}

function updateCrane(id, data) {
  const existing = getCraneById(id);
  
  if (data.max_wind_speed != null && data.max_wind_speed < 0) {
    throw new ValidationError('最大允许风速不能为负数');
  }
  
  if (data.max_load != null && data.max_load <= 0) {
    throw new ValidationError('最大起重重量必须大于0');
  }
  
  if (data.code && data.code !== existing.code) {
    const duplicate = prepare('SELECT id FROM cranes WHERE code = ? AND id != ?').get(data.code, id);
    if (duplicate) {
      throw new ValidationError(`塔吊编号 ${data.code} 已存在`);
    }
  }
  
  const now = new Date().toISOString();
  const updates = [];
  const values = [];
  
  if (data.name != null) { updates.push('name = ?'); values.push(data.name); }
  if (data.max_wind_speed != null) { updates.push('max_wind_speed = ?'); values.push(data.max_wind_speed); }
  if (data.max_load != null) { updates.push('max_load = ?'); values.push(data.max_load); }
  if (data.building_range != null) { updates.push('building_range = ?'); values.push(data.building_range); }
  if (data.status != null) { updates.push('status = ?'); values.push(data.status); }
  
  if (updates.length === 0) {
    return existing;
  }
  
  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);
  
  prepare(`UPDATE cranes SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  
  return getCraneById(id);
}

function deleteCrane(id) {
  const existing = getCraneById(id);
  
  const hasApplications = prepare(
    'SELECT COUNT(*) as count FROM lift_applications WHERE crane_id = ?'
  ).get(id);
  
  if (hasApplications.count > 0) {
    throw new ValidationError('该塔吊已有吊次记录，无法删除，请先停用');
  }
  
  prepare('DELETE FROM cranes WHERE id = ?').run(id);
  
  return { id, deleted: true };
}

function createMaterial(data) {
  if (!data.code || !data.name) {
    throw new ValidationError('材料编号和名称为必填项');
  }
  
  if (data.priority != null && (data.priority < 1 || data.priority > 100)) {
    throw new ValidationError('优先级范围为1-100，数值越大优先级越高');
  }
  
  if (data.average_weight != null && data.average_weight <= 0) {
    throw new ValidationError('平均重量必须大于0');
  }
  
  const existing = prepare('SELECT id FROM materials WHERE code = ?').get(data.code);
  if (existing) {
    throw new ValidationError(`材料编号 ${data.code} 已存在`);
  }
  
  const id = uuidv4();
  const now = new Date().toISOString();
  
  prepare(`
    INSERT INTO materials (
      id, code, name, priority, average_weight, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.code,
    data.name,
    data.priority ?? 10,
    data.average_weight ?? 1.0,
    now,
    now
  );
  
  return getMaterialById(id);
}

function getMaterialById(id) {
  const material = prepare('SELECT * FROM materials WHERE id = ?').get(id);
  
  if (!material) {
    throw new NotFoundError(`材料 ${id} 不存在`, 'material');
  }
  
  return material;
}

function getMaterialByCode(code) {
  const material = prepare('SELECT * FROM materials WHERE code = ?').get(code);
  
  if (!material) {
    throw new NotFoundError(`材料 ${code} 不存在`, 'material');
  }
  
  return material;
}

function listMaterials(filters = {}) {
  let query = 'SELECT * FROM materials WHERE 1=1';
  const params = [];
  
  query += ' ORDER BY priority DESC, created_at DESC';
  
  return prepare(query).all(...params);
}

function updateMaterial(id, data) {
  const existing = getMaterialById(id);
  
  if (data.priority != null && (data.priority < 1 || data.priority > 100)) {
    throw new ValidationError('优先级范围为1-100，数值越大优先级越高');
  }
  
  if (data.average_weight != null && data.average_weight <= 0) {
    throw new ValidationError('平均重量必须大于0');
  }
  
  if (data.code && data.code !== existing.code) {
    const duplicate = prepare('SELECT id FROM materials WHERE code = ? AND id != ?').get(data.code, id);
    if (duplicate) {
      throw new ValidationError(`材料编号 ${data.code} 已存在`);
    }
  }
  
  const now = new Date().toISOString();
  const updates = [];
  const values = [];
  
  if (data.name != null) { updates.push('name = ?'); values.push(data.name); }
  if (data.priority != null) { updates.push('priority = ?'); values.push(data.priority); }
  if (data.average_weight != null) { updates.push('average_weight = ?'); values.push(data.average_weight); }
  
  if (updates.length === 0) {
    return existing;
  }
  
  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);
  
  prepare(`UPDATE materials SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  
  return getMaterialById(id);
}

function recordWindSpeed(windSpeed) {
  if (windSpeed == null || windSpeed < 0) {
    throw new ValidationError('风速值无效');
  }
  
  const id = uuidv4();
  const now = new Date().toISOString();
  
  prepare(`
    INSERT INTO weather_data (id, measured_at, wind_speed, created_at)
    VALUES (?, ?, ?, ?)
  `).run(id, now, windSpeed, now);
  
  return { id, measured_at: now, wind_speed: windSpeed };
}

function getLatestWindSpeed() {
  const latest = prepare(
    'SELECT * FROM weather_data ORDER BY measured_at DESC LIMIT 1'
  ).get();
  
  return latest || null;
}

module.exports = {
  createCrane,
  getCraneById,
  getCraneByCode,
  listCranes,
  updateCrane,
  deleteCrane,
  createMaterial,
  getMaterialById,
  getMaterialByCode,
  listMaterials,
  updateMaterial,
  recordWindSpeed,
  getLatestWindSpeed
};
