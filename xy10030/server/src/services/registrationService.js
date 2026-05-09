import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/index.js';
import { logOperation } from './operationLogService.js';
import { createFailedTask } from './failedTaskService.js';
import { ConcurrencyError, NotFoundError, ValidationError, ConflictError, DuplicateRequestError } from '../utils/response.js';

export function validateRegistrationData(data) {
  const errors = [];
  
  if (!data.name || data.name.trim().length === 0) {
    errors.push('姓名不能为空');
  }
  
  if (!data.phone || data.phone.trim().length === 0) {
    errors.push('手机号不能为空');
  }
  
  if (data.phone && !/^1[3-9]\d{9}$/.test(data.phone)) {
    errors.push('手机号格式不正确');
  }
  
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('邮箱格式不正确');
  }
  
  if (errors.length > 0) {
    throw new ValidationError('数据验证失败', errors);
  }
  
  return true;
}

export function checkDuplicateRequest(requestId) {
  const existingLog = db.prepare(`
    SELECT new_data
    FROM operation_logs
    WHERE request_id = ? AND entity_type = 'registration' AND status = 'success'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(requestId);
  
  if (existingLog && existingLog.new_data) {
    return JSON.parse(existingLog.new_data);
  }
  
  return null;
}

export function createRegistration(eventId, data, requestId, operator = 'system') {
  if (!requestId) {
    requestId = uuidv4();
  }
  
  const existing = checkDuplicateRequest(requestId);
  if (existing) {
    throw new DuplicateRequestError('您已提交过报名申请，请稍候或查看我的报名', existing);
  }
  
  validateRegistrationData(data);
  
  const event = db.prepare(`
    SELECT * FROM events WHERE id = ?
  `).get(eventId);
  
  if (!event) {
    throw new NotFoundError('活动不存在');
  }
  
  if (event.status !== 'published') {
    throw new ConflictError('活动未发布，无法报名');
  }
  
  const now = new Date();
  const startTime = new Date(event.start_time);
  if (now > startTime) {
    throw new ConflictError('活动已开始，无法报名');
  }
  
  if (event.capacity > 0 && event.current_count >= event.capacity) {
    throw new ConflictError('活动已满员');
  }
  
  const existingRegistration = db.prepare(`
    SELECT * FROM registrations
    WHERE event_id = ? AND phone = ? AND status != 'cancelled'
  `).get(eventId, data.phone);
  
  if (existingRegistration) {
    throw new ConflictError('该手机号已报名此活动');
  }
  
  const registrationId = uuidv4();
  
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO registrations (id, event_id, name, phone, email, status, request_id, version)
      VALUES (?, ?, ?, ?, ?, 'confirmed', ?, 1)
    `).run(
      registrationId,
      eventId,
      data.name,
      data.phone,
      data.email || null,
      requestId
    );
    
    db.prepare(`
      UPDATE events
      SET current_count = current_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(eventId);
  });
  
  try {
    tx();
  } catch (error) {
    createFailedTask({
      taskType: 'confirm_registration',
      entityType: 'registration',
      entityId: registrationId,
      data: { eventId, ...data, registrationId },
      errorMessage: error.message
    });
    
    throw error;
  }
  
  const registration = getRegistrationById(registrationId);
  
  logOperation({
    entityType: 'registration',
    entityId: registrationId,
    action: 'create',
    operator,
    newData: registration,
    requestId,
    status: 'success'
  });
  
  return registration;
}

export function updateRegistration(registrationId, data, version, requestId, operator = 'system') {
  const currentRegistration = getRegistrationById(registrationId);
  if (!currentRegistration) {
    throw new NotFoundError('报名记录不存在');
  }
  
  if (currentRegistration.status === 'cancelled') {
    throw new ConflictError('已取消的报名不能修改');
  }
  
  if (currentRegistration.version !== version) {
    throw new ConcurrencyError();
  }
  
  if (data.phone && data.phone !== currentRegistration.phone) {
    const existing = db.prepare(`
      SELECT * FROM registrations
      WHERE event_id = ? AND phone = ? AND id != ? AND status != 'cancelled'
    `).get(currentRegistration.event_id, data.phone, registrationId);
    
    if (existing) {
      throw new ConflictError('该手机号已报名此活动');
    }
  }
  
  const updateData = { ...currentRegistration, ...data };
  validateRegistrationData(updateData);
  
  const fields = [];
  const params = [];
  
  if (data.name !== undefined) {
    fields.push('name = ?');
    params.push(data.name);
  }
  if (data.phone !== undefined) {
    fields.push('phone = ?');
    params.push(data.phone);
  }
  if (data.email !== undefined) {
    fields.push('email = ?');
    params.push(data.email);
  }
  
  if (fields.length === 0) {
    return currentRegistration;
  }
  
  fields.push('version = version + 1');
  fields.push('updated_at = CURRENT_TIMESTAMP');
  params.push(registrationId);
  params.push(version);
  
  const stmt = db.prepare(`
    UPDATE registrations
    SET ${fields.join(', ')}
    WHERE id = ? AND version = ?
  `);
  
  const result = stmt.run(...params);
  
  if (result.changes === 0) {
    throw new ConcurrencyError();
  }
  
  const updatedRegistration = getRegistrationById(registrationId);
  
  logOperation({
    entityType: 'registration',
    entityId: registrationId,
    action: 'update',
    operator,
    oldData: currentRegistration,
    newData: updatedRegistration,
    reason: data.reason,
    requestId,
    status: 'success'
  });
  
  return updatedRegistration;
}

export function cancelRegistration(registrationId, version, reason, requestId, operator = 'system') {
  const currentRegistration = getRegistrationById(registrationId);
  if (!currentRegistration) {
    throw new NotFoundError('报名记录不存在');
  }
  
  if (currentRegistration.status === 'cancelled') {
    return currentRegistration;
  }
  
  if (currentRegistration.version !== version) {
    throw new ConcurrencyError();
  }
  
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE registrations
      SET status = 'cancelled', version = version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND version = ?
    `).run(registrationId, version);
    
    if (currentRegistration.status === 'confirmed') {
      db.prepare(`
        UPDATE events
        SET current_count = MAX(0, current_count - 1), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(currentRegistration.event_id);
    }
  });
  
  try {
    tx();
  } catch (error) {
    createFailedTask({
      taskType: 'cancel_registration',
      entityType: 'registration',
      entityId: registrationId,
      data: { registrationId, reason },
      errorMessage: error.message
    });
    
    throw error;
  }
  
  const updatedRegistration = getRegistrationById(registrationId);
  
  logOperation({
    entityType: 'registration',
    entityId: registrationId,
    action: 'cancel',
    operator,
    oldData: currentRegistration,
    newData: updatedRegistration,
    reason: reason || '用户取消报名',
    requestId,
    status: 'success'
  });
  
  return updatedRegistration;
}

export function getRegistrationById(registrationId) {
  return db.prepare(`
    SELECT id, event_id, name, phone, email, status, version, created_at, updated_at
    FROM registrations
    WHERE id = ?
  `).get(registrationId);
}

export function getRegistrations(filters = {}) {
  const { eventId, phone, status, limit = 100, offset = 0 } = filters;
  
  let whereClause = [];
  let params = [];
  
  if (eventId) {
    whereClause.push('event_id = ?');
    params.push(eventId);
  }
  
  if (phone) {
    whereClause.push('phone = ?');
    params.push(phone);
  }
  
  if (status) {
    whereClause.push('status = ?');
    params.push(status);
  }
  
  const where = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';
  
  const registrations = db.prepare(`
    SELECT id, event_id, name, phone, email, status, version, created_at, updated_at
    FROM registrations
    ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
  
  const total = db.prepare(`
    SELECT COUNT(*) as count
    FROM registrations
    ${where}
  `).get(...params);
  
  return { registrations, total: total.count };
}
