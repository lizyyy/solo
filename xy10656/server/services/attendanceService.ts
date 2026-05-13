import db from '../db';
import { v4 as uuidv4 } from 'uuid';
import { logChange } from './changeLogService';
import { hasActiveLeave } from './leaveService';
import { getStopById } from './routeService';
import dayjs from 'dayjs';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  routeId: string;
  stopId: string;
  attendanceDate: string;
  direction: 'morning' | 'evening';
  status: 'normal' | 'absent' | 'changed' | 'leave';
  actualStopId?: string;
  changedBy?: string;
  changeReason?: string;
  parentConfirmed: number;
  confirmedAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export function getAttendanceRecords(params?: {
  studentId?: string;
  routeId?: string;
  attendanceDate?: string;
  direction?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  parentConfirmed?: boolean;
}) {
  let query = `
    SELECT ar.*, 
           s.name as studentName, s.studentNo, s.parentName, s.parentPhone,
           r.name as routeName, r.routeNo,
           st.name as stopName,
           ast.name as actualStopName
    FROM attendance_records ar 
    LEFT JOIN students s ON ar.studentId = s.id 
    LEFT JOIN routes r ON ar.routeId = r.id 
    LEFT JOIN stops st ON ar.stopId = st.id 
    LEFT JOIN stops ast ON ar.actualStopId = ast.id 
    WHERE 1=1
  `;
  const queryParams: any[] = [];

  if (params?.studentId) {
    query += ' AND ar.studentId = ?';
    queryParams.push(params.studentId);
  }

  if (params?.routeId) {
    query += ' AND ar.routeId = ?';
    queryParams.push(params.routeId);
  }

  if (params?.attendanceDate) {
    query += ' AND ar.attendanceDate = ?';
    queryParams.push(params.attendanceDate);
  }

  if (params?.startDate) {
    query += ' AND ar.attendanceDate >= ?';
    queryParams.push(params.startDate);
  }

  if (params?.endDate) {
    query += ' AND ar.attendanceDate <= ?';
    queryParams.push(params.endDate);
  }

  if (params?.direction) {
    query += ' AND ar.direction = ?';
    queryParams.push(params.direction);
  }

  if (params?.status) {
    query += ' AND ar.status = ?';
    queryParams.push(params.status);
  }

  if (params?.parentConfirmed !== undefined) {
    query += ' AND ar.parentConfirmed = ?';
    queryParams.push(params.parentConfirmed ? 1 : 0);
  }

  query += ' ORDER BY ar.createdAt DESC';

  const stmt = db.prepare(query);
  return stmt.all(...queryParams);
}

export function getAttendanceById(id: string) {
  const stmt = db.prepare('SELECT * FROM attendance_records WHERE id = ?');
  return stmt.get(id) as AttendanceRecord | undefined;
}

export function createAttendanceRecord(
  data: Omit<AttendanceRecord, 'id' | 'parentConfirmed' | 'createdAt' | 'updatedAt'>,
  operator?: string
) {
  const existing = db
    .prepare('SELECT * FROM attendance_records WHERE studentId = ? AND attendanceDate = ? AND direction = ?')
    .get(data.studentId, data.attendanceDate, data.direction);

  if (existing) {
    throw new Error('该学生当日该方向已有点名记录');
  }

  if (hasActiveLeave(data.studentId, data.attendanceDate)) {
    throw new Error('该学生当日已请假，无需点名');
  }

  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO attendance_records (id, studentId, routeId, stopId, attendanceDate, direction, status, actualStopId, changedBy, changeReason, createdBy)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    data.studentId,
    data.routeId,
    data.stopId,
    data.attendanceDate,
    data.direction,
    data.status,
    data.actualStopId,
    data.changedBy,
    data.changeReason,
    data.createdBy
  );
  return getAttendanceById(id);
}

export function changeStop(
  id: string,
  newStopId: string,
  changedBy: string,
  changeReason: string
) {
  const record = getAttendanceById(id);
  if (!record) throw new Error('Attendance record not found');

  if (record.parentConfirmed) {
    throw new Error('家长已确认，不能改站');
  }

  const newStop = getStopById(newStopId);
  if (!newStop) throw new Error('新站点不存在');

  if (newStop.routeId !== record.routeId) {
    throw new Error('新站点必须属于同一条线路');
  }

  logChange('attendance', id, 'actualStopId', record.actualStopId, newStopId, changedBy, changeReason);
  logChange('attendance', id, 'status', record.status, 'changed', changedBy, changeReason);

  const stmt = db.prepare(`
    UPDATE attendance_records 
    SET actualStopId = ?, status = 'changed', changedBy = ?, changeReason = ?, updatedAt = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  stmt.run(newStopId, changedBy, changeReason, id);

  return getAttendanceById(id);
}

export function parentConfirm(id: string) {
  const record = getAttendanceById(id);
  if (!record) throw new Error('Attendance record not found');

  if (record.parentConfirmed) {
    throw new Error('已确认，不能重复确认');
  }

  logChange('attendance', id, 'parentConfirmed', 0, 1, undefined, '家长确认');

  const stmt = db.prepare(`
    UPDATE attendance_records 
    SET parentConfirmed = 1, confirmedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  stmt.run(id);

  return getAttendanceById(id);
}

export function getAbnormalRecords(date?: string) {
  const targetDate = date || dayjs().format('YYYY-MM-DD');
  
  const query = `
    SELECT ar.*, 
           s.name as studentName, s.studentNo, s.parentName, s.parentPhone,
           r.name as routeName,
           st.name as stopName,
           ast.name as actualStopName
    FROM attendance_records ar 
    LEFT JOIN students s ON ar.studentId = s.id 
    LEFT JOIN routes r ON ar.routeId = r.id 
    LEFT JOIN stops st ON ar.stopId = st.id 
    LEFT JOIN stops ast ON ar.actualStopId = ast.id 
    WHERE ar.attendanceDate = ? 
    AND (ar.status IN ('absent', 'changed') OR ar.parentConfirmed = 0)
    ORDER BY ar.createdAt DESC
  `;

  const stmt = db.prepare(query);
  return stmt.all(targetDate);
}

export function exportReport(params?: {
  startDate?: string;
  endDate?: string;
  changedBy?: string;
  routeId?: string;
}) {
  let query = `
    SELECT ar.*, 
           s.name as studentName, s.studentNo,
           r.name as routeName,
           st.name as stopName,
           ast.name as actualStopName,
           cl.changedBy as operatorName,
           cl.createdAt as changeTime
    FROM attendance_records ar 
    LEFT JOIN students s ON ar.studentId = s.id 
    LEFT JOIN routes r ON ar.routeId = r.id 
    LEFT JOIN stops st ON ar.stopId = st.id 
    LEFT JOIN stops ast ON ar.actualStopId = ast.id 
    LEFT JOIN change_logs cl ON cl.recordId = ar.id AND cl.recordType = 'attendance'
    WHERE 1=1
  `;
  const queryParams: any[] = [];

  if (params?.startDate) {
    query += ' AND ar.attendanceDate >= ?';
    queryParams.push(params.startDate);
  }

  if (params?.endDate) {
    query += ' AND ar.attendanceDate <= ?';
    queryParams.push(params.endDate);
  }

  if (params?.changedBy) {
    query += ' AND cl.changedBy LIKE ?';
    queryParams.push(`%${params.changedBy}%`);
  }

  if (params?.routeId) {
    query += ' AND ar.routeId = ?';
    queryParams.push(params.routeId);
  }

  query += ' GROUP BY ar.id ORDER BY ar.attendanceDate DESC';

  const stmt = db.prepare(query);
  return stmt.all(...queryParams);
}
