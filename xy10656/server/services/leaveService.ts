import db from '../db';
import { v4 as uuidv4 } from 'uuid';
import { logChange } from './changeLogService';

export interface LeaveApplication {
  id: string;
  studentId: string;
  leaveDate: string;
  leaveType: string;
  reason?: string;
  status: string;
  approvedBy?: string;
  approvedAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export function getLeaveApplications(params?: {
  studentId?: string;
  leaveDate?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}) {
  let query = `
    SELECT la.*, s.name as studentName, s.studentNo 
    FROM leave_applications la 
    LEFT JOIN students s ON la.studentId = s.id 
    WHERE 1=1
  `;
  const queryParams: any[] = [];

  if (params?.studentId) {
    query += ' AND la.studentId = ?';
    queryParams.push(params.studentId);
  }

  if (params?.leaveDate) {
    query += ' AND la.leaveDate = ?';
    queryParams.push(params.leaveDate);
  }

  if (params?.startDate) {
    query += ' AND la.leaveDate >= ?';
    queryParams.push(params.startDate);
  }

  if (params?.endDate) {
    query += ' AND la.leaveDate <= ?';
    queryParams.push(params.endDate);
  }

  if (params?.status) {
    query += ' AND la.status = ?';
    queryParams.push(params.status);
  }

  query += ' ORDER BY la.createdAt DESC';

  const stmt = db.prepare(query);
  return stmt.all(...queryParams);
}

export function getLeaveById(id: string) {
  const stmt = db.prepare('SELECT * FROM leave_applications WHERE id = ?');
  return stmt.get(id) as LeaveApplication | undefined;
}

export function createLeaveApplication(
  data: Omit<LeaveApplication, 'id' | 'createdAt' | 'updatedAt'>,
  operator?: string
) {
  const existing = db
    .prepare('SELECT * FROM leave_applications WHERE studentId = ? AND leaveDate = ? AND status != "rejected"')
    .get(data.studentId, data.leaveDate);

  if (existing) {
    throw new Error('该学生当日已有有效请假申请');
  }

  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO leave_applications (id, studentId, leaveDate, leaveType, reason, status, createdBy)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    data.studentId,
    data.leaveDate,
    data.leaveType,
    data.reason,
    data.status || 'pending',
    data.createdBy
  );
  return getLeaveById(id);
}

export function updateLeaveApplication(id: string, data: Partial<LeaveApplication>, operator?: string) {
  const leave = getLeaveById(id);
  if (!leave) throw new Error('Leave application not found');

  if (leave.status === 'approved') {
    throw new Error('已批准的请假申请不能修改');
  }

  const fields = Object.keys(data).filter(
    k => !['id', 'createdAt', 'updatedAt', 'approvedAt'].includes(k)
  );
  if (fields.length === 0) return leave;

  fields.forEach(field => {
    const oldValue = (leave as any)[field];
    const newValue = (data as any)[field];
    if (oldValue !== newValue) {
      logChange('leave', id, field, oldValue, newValue, operator, '更新请假申请');
    }
  });

  const setClause = fields.map(f => `${f} = ?`).join(', ');
  const params = fields.map(f => (data as any)[f]);
  params.push(id);

  const stmt = db.prepare(`UPDATE leave_applications SET ${setClause}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`);
  stmt.run(...params);

  return getLeaveById(id);
}

export function approveLeave(id: string, approvedBy: string) {
  const leave = getLeaveById(id);
  if (!leave) throw new Error('Leave application not found');

  if (leave.status !== 'pending') {
    throw new Error('只能审批待处理的请假申请');
  }

  logChange('leave', id, 'status', leave.status, 'approved', approvedBy, '批准请假');

  const stmt = db.prepare(`
    UPDATE leave_applications 
    SET status = 'approved', approvedBy = ?, approvedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  stmt.run(approvedBy, id);

  return getLeaveById(id);
}

export function rejectLeave(id: string, approvedBy: string, reason?: string) {
  const leave = getLeaveById(id);
  if (!leave) throw new Error('Leave application not found');

  if (leave.status !== 'pending') {
    throw new Error('只能审批待处理的请假申请');
  }

  logChange('leave', id, 'status', leave.status, 'rejected', approvedBy, reason || '拒绝请假');

  const stmt = db.prepare(`
    UPDATE leave_applications 
    SET status = 'rejected', approvedBy = ?, approvedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  stmt.run(approvedBy, id);

  return getLeaveById(id);
}

export function hasActiveLeave(studentId: string, date: string): boolean {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count 
    FROM leave_applications 
    WHERE studentId = ? AND leaveDate = ? AND status = 'approved'
  `);
  const result = stmt.get(studentId, date) as { count: number };
  return result.count > 0;
}
