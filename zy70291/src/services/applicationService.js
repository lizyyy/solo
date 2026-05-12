const { v4: uuidv4 } = require('uuid');
const { prepare } = require('../db');
const craneService = require('./craneService');
const { APPLICATION_STATES, canTransition, isFinalState, isModifiableState } = require('../utils/status');
const { 
  ValidationError, 
  NotFoundError, 
  StateConflictError, 
  DuplicateRequestError,
  SourceRecordMissingError
} = require('../utils/errors');

function generateApplicationNo() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `LA-${dateStr}-${random}`;
}

function logStatusChange(applicationId, action, fromStatus, toStatus, performedBy, reason) {
  const id = uuidv4();
  prepare(`
    INSERT INTO application_logs (
      id, application_id, action, from_status, to_status, 
      performed_by, reason, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    applicationId,
    action,
    fromStatus,
    toStatus,
    performedBy || null,
    reason || null,
    new Date().toISOString()
  );
}

function createApplication(data) {
  if (!data.crane_id && !data.crane_code) {
    throw new ValidationError('必须指定塔吊ID或编号');
  }
  
  if (!data.material_id && !data.material_code) {
    throw new ValidationError('必须指定材料ID或编号');
  }
  
  if (!data.building_no) {
    throw new ValidationError('必须指定楼栋号');
  }
  
  if (!data.floor || data.floor < 1) {
    throw new ValidationError('楼层号必须大于0');
  }
  
  if (!data.requested_by) {
    throw new ValidationError('必须指定申请人');
  }
  
  let craneId = data.crane_id;
  if (!craneId && data.crane_code) {
    const crane = craneService.getCraneByCode(data.crane_code);
    craneId = crane.id;
  } else {
    craneService.getCraneById(craneId);
  }
  
  let materialId = data.material_id;
  let material = null;
  if (!materialId && data.material_code) {
    material = craneService.getMaterialByCode(data.material_code);
    materialId = material.id;
  } else {
    material = craneService.getMaterialById(materialId);
  }
  
  if (data.source_record_id) {
    const source = prepare(
      'SELECT id FROM lift_records WHERE id = ?'
    ).get(data.source_record_id);
    if (!source) {
      throw new SourceRecordMissingError(
        `来源吊次记录 ${data.source_record_id} 不存在`,
        data.source_record_id
      );
    }
  }
  
  const quantity = data.quantity || 1;
  const estimatedWeight = data.estimated_weight || (material.average_weight * quantity);
  
  const id = uuidv4();
  const applicationNo = generateApplicationNo();
  const now = new Date().toISOString();
  const effectivePriority = data.priority ?? material.priority;
  
  prepare(`
    INSERT INTO lift_applications (
      id, application_no, crane_id, material_id, building_no, floor,
      quantity, estimated_weight, requested_by, requested_at,
      status, priority, source_record_id, created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    id,
    applicationNo,
    craneId,
    materialId,
    data.building_no,
    data.floor,
    quantity,
    estimatedWeight,
    data.requested_by,
    data.requested_at || now,
    APPLICATION_STATES.PENDING,
    effectivePriority,
    data.source_record_id || null,
    now,
    now
  );
  
  logStatusChange(
    id, 'CREATE', null, APPLICATION_STATES.PENDING,
    data.requested_by, '创建吊次申请'
  );
  
  return getApplicationById(id);
}

function getApplicationById(id) {
  const application = prepare(`
    SELECT 
      la.*,
      c.code as crane_code,
      c.name as crane_name,
      c.max_wind_speed as crane_max_wind_speed,
      c.max_load as crane_max_load,
      c.building_range as crane_building_range,
      m.code as material_code,
      m.name as material_name,
      m.priority as material_priority,
      m.average_weight as material_average_weight
    FROM lift_applications la
    JOIN cranes c ON la.crane_id = c.id
    JOIN materials m ON la.material_id = m.id
    WHERE la.id = ?
  `).get(id);
  
  if (!application) {
    throw new NotFoundError(`吊次申请 ${id} 不存在`, 'application');
  }
  
  return application;
}

function getApplicationByNo(applicationNo) {
  const application = prepare(`
    SELECT 
      la.*,
      c.code as crane_code,
      c.name as crane_name,
      m.code as material_code,
      m.name as material_name
    FROM lift_applications la
    JOIN cranes c ON la.crane_id = c.id
    JOIN materials m ON la.material_id = m.id
    WHERE la.application_no = ?
  `).get(applicationNo);
  
  if (!application) {
    throw new NotFoundError(`吊次申请 ${applicationNo} 不存在`, 'application');
  }
  
  return application;
}

function listApplications(filters = {}) {
  let query = `
    SELECT 
      la.*,
      c.code as crane_code,
      c.name as crane_name,
      m.code as material_code,
      m.name as material_name,
      m.priority as material_priority
    FROM lift_applications la
    JOIN cranes c ON la.crane_id = c.id
    JOIN materials m ON la.material_id = m.id
    WHERE 1=1
  `;
  const params = [];
  
  if (filters.crane_id) {
    query += ' AND la.crane_id = ?';
    params.push(filters.crane_id);
  }
  
  if (filters.crane_code) {
    query += ' AND c.code = ?';
    params.push(filters.crane_code);
  }
  
  if (filters.building_no) {
    query += ' AND la.building_no = ?';
    params.push(filters.building_no);
  }
  
  if (filters.status) {
    query += ' AND la.status = ?';
    params.push(filters.status);
  }
  
  if (filters.material_code) {
    query += ' AND m.code = ?';
    params.push(filters.material_code);
  }
  
  query += ' ORDER BY la.priority DESC, la.created_at ASC';
  
  return prepare(query).all(...params);
}

function transitionState(id, newState, performedBy, reason, additionalData = {}) {
  const application = getApplicationById(id);
  const currentState = application.status;
  
  if (isFinalState(currentState)) {
    throw new StateConflictError(
      `申请已处于终态 ${currentState}，无法修改`,
      currentState
    );
  }
  
  if (!canTransition(currentState, newState)) {
    throw new StateConflictError(
      `不允许从 ${currentState} 直接跳转到 ${newState}`,
      currentState
    );
  }
  
  const now = new Date().toISOString();
  const updates = [];
  const values = [];
  
  updates.push('status = ?');
  values.push(newState);
  updates.push('updated_at = ?');
  values.push(now);
  updates.push('version = version + 1');
  
  if (additionalData.scheduled_time) {
    updates.push('scheduled_time = ?');
    values.push(additionalData.scheduled_time);
  }
  
  if (additionalData.executed_time) {
    updates.push('executed_time = ?');
    values.push(additionalData.executed_time);
  }
  
  if (additionalData.completed_time) {
    updates.push('completed_time = ?');
    values.push(additionalData.completed_time);
  }
  
  values.push(id);
  values.push(application.version);
  
  prepare(`
    UPDATE lift_applications 
    SET ${updates.join(', ')} 
    WHERE id = ? AND version = ?
  `).run(...values);
  
  logStatusChange(id, 'TRANSITION', currentState, newState, performedBy, reason);
  
  return getApplicationById(id);
}

function scheduleApplication(id, data = {}) {
  const now = new Date().toISOString();
  return transitionState(
    id,
    APPLICATION_STATES.SCHEDULED,
    data.performed_by,
    data.reason || '已安排吊次',
    { scheduled_time: data.scheduled_time || now }
  );
}

function startApplication(id, data = {}) {
  const application = getApplicationById(id);
  const latestWind = craneService.getLatestWindSpeed();
  
  if (latestWind && latestWind.wind_speed > application.crane_max_wind_speed) {
    throw new ValidationError(
      `当前风速 ${latestWind.wind_speed} m/s 超过塔吊最大允许风速 ${application.crane_max_wind_speed} m/s，禁止作业`
    );
  }
  
  const now = new Date().toISOString();
  
  const maxOrder = prepare(
    'SELECT MAX(schedule_order) as max_order FROM lift_records WHERE crane_id = ? AND DATE(started_at) = DATE(?)'
  ).get(application.crane_id, now);
  
  const nextOrder = (maxOrder.max_order || 0) + 1;
  
  const recordId = uuidv4();
  prepare(`
    INSERT INTO lift_records (
      id, application_id, crane_id, material_id, building_no, floor,
      actual_weight, wind_speed, operator, started_at, status, schedule_order, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    recordId,
    id,
    application.crane_id,
    application.material_id,
    application.building_no,
    application.floor,
    application.estimated_weight,
    latestWind ? latestWind.wind_speed : 0,
    data.operator || null,
    now,
    'IN_PROGRESS',
    nextOrder,
    now
  );
  
  return transitionState(
    id,
    APPLICATION_STATES.IN_PROGRESS,
    data.performed_by,
    data.reason || '开始执行吊次',
    { executed_time: now }
  );
}

function completeApplication(id, data = {}) {
  const application = getApplicationById(id);
  
  const record = prepare(
    'SELECT id FROM lift_records WHERE application_id = ? AND status = ?'
  ).get(id, 'IN_PROGRESS');
  
  if (record) {
    const now = new Date().toISOString();
    prepare(`
      UPDATE lift_records 
      SET status = 'COMPLETED', completed_at = ?
      WHERE id = ?
    `).run(now, record.id);
  }
  
  const now = new Date().toISOString();
  return transitionState(
    id,
    APPLICATION_STATES.COMPLETED,
    data.performed_by,
    data.reason || '吊次完成',
    { completed_time: now }
  );
}

function cancelApplication(id, data = {}) {
  const application = getApplicationById(id);
  
  const inProgressRecord = prepare(
    'SELECT id FROM lift_records WHERE application_id = ? AND status = ?'
  ).get(id, 'IN_PROGRESS');
  
  if (inProgressRecord) {
    const now = new Date().toISOString();
    prepare(`
      UPDATE lift_records 
      SET status = 'CANCELLED', completed_at = ?
      WHERE id = ?
    `).run(now, inProgressRecord.id);
  }
  
  return transitionState(
    id,
    APPLICATION_STATES.CANCELLED,
    data.performed_by,
    data.reason || '取消吊次申请'
  );
}

function reviseApplication(id, data) {
  const application = getApplicationById(id);
  
  if (!isModifiableState(application.status)) {
    throw new StateConflictError(
      `当前状态 ${application.status} 不允许修正`,
      application.status
    );
  }
  
  if (!data || Object.keys(data).length === 0) {
    throw new ValidationError('必须提供修正内容');
  }
  
  const updates = [];
  const values = [];
  
  if (data.crane_id) {
    craneService.getCraneById(data.crane_id);
    updates.push('crane_id = ?');
    values.push(data.crane_id);
  }
  
  if (data.material_id) {
    const material = craneService.getMaterialById(data.material_id);
    updates.push('material_id = ?');
    values.push(data.material_id);
    
    if (!data.estimated_weight && data.quantity) {
      data.estimated_weight = material.average_weight * data.quantity;
    }
  }
  
  if (data.building_no != null) { updates.push('building_no = ?'); values.push(data.building_no); }
  if (data.floor != null) { updates.push('floor = ?'); values.push(data.floor); }
  if (data.quantity != null) { updates.push('quantity = ?'); values.push(data.quantity); }
  if (data.estimated_weight != null) { updates.push('estimated_weight = ?'); values.push(data.estimated_weight); }
  if (data.priority != null) { updates.push('priority = ?'); values.push(data.priority); }
  
  if (updates.length === 0) {
    return application;
  }
  
  const now = new Date().toISOString();
  updates.push('updated_at = ?');
  values.push(now);
  updates.push('version = version + 1');
  values.push(id);
  values.push(application.version);
  
  prepare(`
    UPDATE lift_applications 
    SET ${updates.join(', ')} 
    WHERE id = ? AND version = ?
  `).run(...values);
  
  if (application.status !== APPLICATION_STATES.REVISED) {
    logStatusChange(
      id, 'REVISE', application.status, application.status,
      data.performed_by, data.reason || '修正吊次信息'
    );
  }
  
  return getApplicationById(id);
}

function getApplicationLogs(id) {
  return prepare(`
    SELECT * FROM application_logs 
    WHERE application_id = ? 
    ORDER BY created_at ASC
  `).all(id);
}

module.exports = {
  createApplication,
  getApplicationById,
  getApplicationByNo,
  listApplications,
  scheduleApplication,
  startApplication,
  completeApplication,
  cancelApplication,
  reviseApplication,
  getApplicationLogs,
  APPLICATION_STATES
};
