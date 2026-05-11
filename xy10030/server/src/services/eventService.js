import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/index.js';
import { logOperation } from './operationLogService.js';
import { ConcurrencyError, NotFoundError, ValidationError, ConflictError, DuplicateRequestError } from '../utils/response.js';

export function checkDuplicateEventRequest(requestId) {
  if (!requestId) return null;
  
  const existingLog = db.prepare(`
    SELECT new_data
    FROM operation_logs
    WHERE request_id = ? AND entity_type = 'event' AND status = 'success'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(requestId);
  
  if (existingLog && existingLog.new_data) {
    return JSON.parse(existingLog.new_data);
  }
  
  return null;
}

export function validateEventData(data) {
  const errors = [];
  
  if (!data.title || data.title.trim().length === 0) {
    errors.push('活动标题不能为空');
  }
  
  if (!data.start_time) {
    errors.push('开始时间不能为空');
  }
  
  if (!data.end_time) {
    errors.push('结束时间不能为空');
  }
  
  if (data.start_time && data.end_time) {
    const startTime = new Date(data.start_time);
    const endTime = new Date(data.end_time);
    if (startTime >= endTime) {
      errors.push('开始时间必须早于结束时间');
    }
  }
  
  if (!data.location || data.location.trim().length === 0) {
    errors.push('活动地点不能为空');
  }
  
  if (data.capacity !== undefined && data.capacity < 0) {
    errors.push('容量不能为负数');
  }
  
  if (errors.length > 0) {
    throw new ValidationError('数据验证失败', errors);
  }
  
  return true;
}

export function createEvent(data, requestId, operator = 'system') {
  if (!requestId) {
    requestId = uuidv4();
  }
  
  const existing = checkDuplicateEventRequest(requestId);
  if (existing) {
    throw new DuplicateRequestError('相同请求已处理', existing);
  }
  
  validateEventData(data);
  
  const eventId = uuidv4();
  
  const stmt = db.prepare(`
    INSERT INTO events (id, title, description, start_time, end_time, location, capacity, status, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  
  const status = data.status || 'draft';
  
  stmt.run(
    eventId,
    data.title,
    data.description || null,
    data.start_time,
    data.end_time,
    data.location,
    data.capacity || 0,
    status
  );
  
  const event = getEventById(eventId);
  
  logOperation({
    entityType: 'event',
    entityId: eventId,
    action: 'create',
    operator,
    newData: event,
    requestId,
    status: 'success'
  });
  
  return event;
}

export function updateEvent(eventId, data, version, requestId, operator = 'system') {
  const currentEvent = getEventById(eventId);
  if (!currentEvent) {
    throw new NotFoundError('活动不存在');
  }
  
  if (currentEvent.version !== version) {
    throw new ConcurrencyError();
  }
  
  if (data.status === 'cancelled' && currentEvent.status === 'completed') {
    throw new ConflictError('已完成的活动不能取消');
  }
  
  const updateData = { ...currentEvent, ...data };
  validateEventData(updateData);
  
  const fields = [];
  const params = [];
  
  if (data.title !== undefined) {
    fields.push('title = ?');
    params.push(data.title);
  }
  if (data.description !== undefined) {
    fields.push('description = ?');
    params.push(data.description);
  }
  if (data.start_time !== undefined) {
    fields.push('start_time = ?');
    params.push(data.start_time);
  }
  if (data.end_time !== undefined) {
    fields.push('end_time = ?');
    params.push(data.end_time);
  }
  if (data.location !== undefined) {
    fields.push('location = ?');
    params.push(data.location);
  }
  if (data.capacity !== undefined) {
    if (data.capacity < currentEvent.current_count) {
      throw new ValidationError('容量不能小于当前报名人数');
    }
    fields.push('capacity = ?');
    params.push(data.capacity);
  }
  if (data.status !== undefined) {
    fields.push('status = ?');
    params.push(data.status);
  }
  
  if (fields.length === 0) {
    return currentEvent;
  }
  
  fields.push('version = version + 1');
  fields.push('updated_at = CURRENT_TIMESTAMP');
  params.push(eventId);
  params.push(version);
  
  const stmt = db.prepare(`
    UPDATE events
    SET ${fields.join(', ')}
    WHERE id = ? AND version = ?
  `);
  
  const result = stmt.run(...params);
  
  if (result.changes === 0) {
    throw new ConcurrencyError();
  }
  
  const updatedEvent = getEventById(eventId);
  
  logOperation({
    entityType: 'event',
    entityId: eventId,
    action: 'update',
    operator,
    oldData: currentEvent,
    newData: updatedEvent,
    reason: data.reason,
    requestId,
    status: 'success'
  });
  
  return updatedEvent;
}

export function cancelEvent(eventId, version, reason, requestId, operator = 'system') {
  return updateEvent(eventId, { status: 'cancelled', reason }, version, requestId, operator);
}

export function getEventById(eventId) {
  return db.prepare(`
    SELECT id, title, description, start_time, end_time, location, capacity, current_count, status, version, created_at, updated_at
    FROM events
    WHERE id = ?
  `).get(eventId);
}

export function getEvents(filters = {}) {
  const { status, search, limit = 100, offset = 0 } = filters;
  
  let whereClause = [];
  let params = [];
  
  if (status) {
    whereClause.push('status = ?');
    params.push(status);
  }
  
  if (search) {
    whereClause.push('(title LIKE ? OR location LIKE ?)');
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern);
  }
  
  const where = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';
  
  const events = db.prepare(`
    SELECT id, title, description, start_time, end_time, location, capacity, current_count, status, version, created_at, updated_at
    FROM events
    ${where}
    ORDER BY start_time DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
  
  const total = db.prepare(`
    SELECT COUNT(*) as count
    FROM events
    ${where}
  `).get(...params);
  
  return { events, total: total.count };
}

export function getEventRegistrations(eventId, filters = {}) {
  const { status, limit = 100, offset = 0 } = filters;
  
  let whereClause = ['event_id = ?'];
  let params = [eventId];
  
  if (status) {
    whereClause.push('status = ?');
    params.push(status);
  }
  
  const where = `WHERE ${whereClause.join(' AND ')}`;
  
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
