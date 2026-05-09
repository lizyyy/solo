import { Parser } from 'json2csv';
import { db } from '../database/index.js';

export function generateEventsReport(format = 'json') {
  const events = db.prepare(`
    SELECT e.id, e.title, e.description, e.start_time, e.end_time, e.location, e.capacity, e.current_count, e.status, e.created_at, e.updated_at,
           (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'confirmed') as confirmed_count,
           (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'cancelled') as cancelled_count
    FROM events e
    ORDER BY e.created_at DESC
  `).all();
  
  if (format === 'csv') {
    const fields = [
      { label: '活动ID', value: 'id' },
      { label: '活动标题', value: 'title' },
      { label: '活动描述', value: 'description' },
      { label: '开始时间', value: 'start_time' },
      { label: '结束时间', value: 'end_time' },
      { label: '地点', value: 'location' },
      { label: '容量', value: 'capacity' },
      { label: '当前人数', value: 'current_count' },
      { label: '已确认', value: 'confirmed_count' },
      { label: '已取消', value: 'cancelled_count' },
      { label: '状态', value: 'status' },
      { label: '创建时间', value: 'created_at' },
      { label: '更新时间', value: 'updated_at' }
    ];
    
    const parser = new Parser({ fields });
    return parser.parse(events);
  }
  
  return events;
}

export function generateRegistrationsReport(eventId = null, format = 'json') {
  let query = `
    SELECT r.id, r.event_id, e.title as event_title, r.name, r.phone, r.email, r.status, r.created_at, r.updated_at
    FROM registrations r
    JOIN events e ON r.event_id = e.id
  `;
  
  let params = [];
  
  if (eventId) {
    query += ' WHERE r.event_id = ?';
    params.push(eventId);
  }
  
  query += ' ORDER BY r.created_at DESC';
  
  const registrations = db.prepare(query).all(...params);
  
  if (format === 'csv') {
    const fields = [
      { label: '报名ID', value: 'id' },
      { label: '活动ID', value: 'event_id' },
      { label: '活动标题', value: 'event_title' },
      { label: '姓名', value: 'name' },
      { label: '手机号', value: 'phone' },
      { label: '邮箱', value: 'email' },
      { label: '状态', value: 'status' },
      { label: '报名时间', value: 'created_at' },
      { label: '更新时间', value: 'updated_at' }
    ];
    
    const parser = new Parser({ fields });
    return parser.parse(registrations);
  }
  
  return registrations;
}

export function generateOperationLogsReport(filters = {}, format = 'json') {
  const { entityType, entityId, action, status, limit = 1000 } = filters;
  
  let whereClause = [];
  let params = [];
  
  if (entityType) {
    whereClause.push('entity_type = ?');
    params.push(entityType);
  }
  if (entityId) {
    whereClause.push('entity_id = ?');
    params.push(entityId);
  }
  if (action) {
    whereClause.push('action = ?');
    params.push(action);
  }
  if (status) {
    whereClause.push('status = ?');
    params.push(status);
  }
  
  const where = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';
  
  const logs = db.prepare(`
    SELECT id, entity_type, entity_id, action, operator, old_data, new_data, reason, request_id, status, created_at
    FROM operation_logs
    ${where}
    ORDER BY created_at DESC
    LIMIT ?
  `).all(...params, limit);
  
  const formattedLogs = logs.map(log => ({
    ...log,
    old_data: log.old_data ? JSON.parse(log.old_data) : null,
    new_data: log.new_data ? JSON.parse(log.new_data) : null
  }));
  
  if (format === 'csv') {
    const fields = [
      { label: '日志ID', value: 'id' },
      { label: '实体类型', value: 'entity_type' },
      { label: '实体ID', value: 'entity_id' },
      { label: '操作类型', value: 'action' },
      { label: '操作者', value: 'operator' },
      { label: '原因', value: 'reason' },
      { label: '请求ID', value: 'request_id' },
      { label: '状态', value: 'status' },
      { label: '操作时间', value: 'created_at' }
    ];
    
    const parser = new Parser({ fields });
    return parser.parse(formattedLogs);
  }
  
  return formattedLogs;
}

export function generateStatistics() {
  const totalEvents = db.prepare(`
    SELECT COUNT(*) as count FROM events
  `).get();
  
  const publishedEvents = db.prepare(`
    SELECT COUNT(*) as count FROM events WHERE status = 'published'
  `).get();
  
  const cancelledEvents = db.prepare(`
    SELECT COUNT(*) as count FROM events WHERE status = 'cancelled'
  `).get();
  
  const totalRegistrations = db.prepare(`
    SELECT COUNT(*) as count FROM registrations
  `).get();
  
  const confirmedRegistrations = db.prepare(`
    SELECT COUNT(*) as count FROM registrations WHERE status = 'confirmed'
  `).get();
  
  const cancelledRegistrations = db.prepare(`
    SELECT COUNT(*) as count FROM registrations WHERE status = 'cancelled'
  `).get();
  
  const pendingTasks = db.prepare(`
    SELECT COUNT(*) as count FROM failed_tasks WHERE status = 'pending'
  `).get();
  
  const failedTasks = db.prepare(`
    SELECT COUNT(*) as count FROM failed_tasks WHERE status = 'failed'
  `).get();
  
  return {
    events: {
      total: totalEvents.count,
      published: publishedEvents.count,
      cancelled: cancelledEvents.count
    },
    registrations: {
      total: totalRegistrations.count,
      confirmed: confirmedRegistrations.count,
      cancelled: cancelledRegistrations.count
    },
    tasks: {
      pending: pendingTasks.count,
      failed: failedTasks.count
    }
  };
}
