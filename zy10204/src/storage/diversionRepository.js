const { getDatabase } = require('./database');

function insertDiversion(diversion) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO diversions (id, date, reason, diversion_type, status, created_at, updated_at)
    VALUES (@id, @date, @reason, @diversionType, @status, @createdAt, @updatedAt)
  `);
  stmt.run(diversion);
  return diversion;
}

function findDiversionByDate(date) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM diversions WHERE date = ? ORDER BY created_at DESC').get(date);
  return row ? mapToDiversion(row) : null;
}

function findDiversionById(id) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM diversions WHERE id = ?').get(id);
  return row ? mapToDiversion(row) : null;
}

function updateDiversionStatus(id, status) {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE diversions SET status = ?, updated_at = ? WHERE id = ?
  `);
  stmt.run(status, new Date().toISOString(), id);
  return findDiversionById(id);
}

function insertDiversionLine(diversionLine) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO diversion_lines (id, diversion_id, line_id, original_stop_id, new_stop_id, is_skipped, created_at)
    VALUES (@id, @diversionId, @lineId, @originalStopId, @newStopId, @isSkipped, @createdAt)
  `);
  const data = {
    ...diversionLine,
    isSkipped: diversionLine.isSkipped ? 1 : 0
  };
  stmt.run(data);
  return diversionLine;
}

function getDiversionLines(diversionId) {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT dl.*, l.code as line_code, l.name as line_name,
           os.code as original_stop_code, os.name as original_stop_name,
           ns.code as new_stop_code, ns.name as new_stop_name
    FROM diversion_lines dl
    JOIN lines l ON dl.line_id = l.id
    JOIN stops os ON dl.original_stop_id = os.id
    LEFT JOIN stops ns ON dl.new_stop_id = ns.id
    WHERE dl.diversion_id = ?
    ORDER BY l.code, dl.id
  `).all(diversionId);
  return rows.map(mapToDiversionLine);
}

function getDiversionLinesByLine(diversionId, lineId) {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT dl.*, l.code as line_code, l.name as line_name,
           os.code as original_stop_code, os.name as original_stop_name,
           ns.code as new_stop_code, ns.name as new_stop_name
    FROM diversion_lines dl
    JOIN lines l ON dl.line_id = l.id
    JOIN stops os ON dl.original_stop_id = os.id
    LEFT JOIN stops ns ON dl.new_stop_id = ns.id
    WHERE dl.diversion_id = ? AND dl.line_id = ?
    ORDER by dl.id
  `).all(diversionId, lineId);
  return rows.map(mapToDiversionLine);
}

function insertLeave(leave) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO leaves (id, student_id, date, leave_type, note, status, created_at)
    VALUES (@id, @studentId, @date, @leaveType, @note, @status, @createdAt)
  `);
  stmt.run(leave);
  return leave;
}

function findLeave(studentId, date) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM leaves WHERE student_id = ? AND date = ?').get(studentId, date);
  return row ? mapToLeave(row) : null;
}

function getLeavesByDate(date) {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT l.*, s.name as student_name, s.student_id as student_school_id
    FROM leaves l
    JOIN students s ON l.student_id = s.id
    WHERE l.date = ? AND l.status = 'approved'
  `).all(date);
  return rows.map(mapToLeaveWithStudent);
}

function insertNotification(notification) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO notifications (id, student_id, diversion_id, parent_id, notification_type, content, status, created_at, sent_at)
    VALUES (@id, @studentId, @diversionId, @parentId, @notificationType, @content, @status, @createdAt, @sentAt)
  `);
  try {
    stmt.run(notification);
    return notification;
  } catch (e) {
    if (e.message.includes('UNIQUE constraint failed')) {
      return null;
    }
    throw e;
  }
}

function getNotifications(diversionId, type = null) {
  const db = getDatabase();
  let query = `
    SELECT n.*, s.name as student_name, s.student_id as student_school_id,
           p.name as parent_name, p.phone as parent_phone
    FROM notifications n
    JOIN students s ON n.student_id = s.id
    JOIN parents p ON n.parent_id = p.id
    WHERE n.diversion_id = ?
  `;
  const params = [diversionId];

  if (type) {
    query += ' AND n.notification_type = ?';
    params.push(type);
  }
  query += ' ORDER BY s.name, n.notification_type';

  const rows = db.prepare(query).all(...params);
  return rows.map(mapToNotificationWithDetails);
}

function hasNotificationsForDiversion(diversionId) {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT COUNT(*) as count FROM notifications WHERE diversion_id = ?
  `).get(diversionId);
  return row.count > 0;
}

function mapToDiversion(row) {
  return {
    id: row.id,
    date: row.date,
    reason: row.reason,
    diversionType: row.diversion_type,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapToDiversionLine(row) {
  return {
    id: row.id,
    diversionId: row.diversion_id,
    lineId: row.line_id,
    lineCode: row.line_code,
    lineName: row.line_name,
    originalStopId: row.original_stop_id,
    originalStopCode: row.original_stop_code,
    originalStopName: row.original_stop_name,
    newStopId: row.new_stop_id,
    newStopCode: row.new_stop_code,
    newStopName: row.new_stop_name,
    isSkipped: row.is_skipped === 1,
    createdAt: row.created_at
  };
}

function mapToLeave(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    date: row.date,
    leaveType: row.leave_type,
    note: row.note,
    status: row.status,
    createdAt: row.created_at
  };
}

function mapToLeaveWithStudent(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    studentSchoolId: row.student_school_id,
    date: row.date,
    leaveType: row.leave_type,
    note: row.note,
    status: row.status,
    createdAt: row.created_at
  };
}

function mapToNotificationWithDetails(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    studentSchoolId: row.student_school_id,
    diversionId: row.diversion_id,
    parentId: row.parent_id,
    parentName: row.parent_name,
    parentPhone: row.parent_phone,
    notificationType: row.notification_type,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
    sentAt: row.sent_at
  };
}

module.exports = {
  insertDiversion,
  findDiversionByDate,
  findDiversionById,
  updateDiversionStatus,
  insertDiversionLine,
  getDiversionLines,
  getDiversionLinesByLine,
  insertLeave,
  findLeave,
  getLeavesByDate,
  insertNotification,
  getNotifications,
  hasNotificationsForDiversion
};
