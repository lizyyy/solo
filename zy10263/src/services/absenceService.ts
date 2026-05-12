import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync } from '../database/connection';
import { Absence } from '../types';
import { recordHistory } from './historyService';

export const getAbsences = async (employeeId?: string, date?: string): Promise<Absence[]> => {
  let sql = `
    SELECT 
      id, employee_id as employeeId, date, type,
      reason, hours, approved_by as approvedBy,
      approved_at as approvedAt, created_at as createdAt
     FROM absences
  `;
  const params: any[] = [];
  const conditions: string[] = [];

  if (employeeId) {
    conditions.push('employee_id = ?');
    params.push(employeeId);
  }
  if (date) {
    conditions.push('date = ?');
    params.push(date);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY date DESC, created_at DESC';

  return allAsync(sql, params);
};

export const createAbsence = async (
  data: {
    employeeId: string;
    date: string;
    type: 'sick' | 'personal' | 'annual' | 'other';
    reason?: string;
    hours: number;
  },
  operatorId: string,
  operatorName: string
): Promise<Absence> => {
  const existing = await getAsync(
    'SELECT id FROM absences WHERE employee_id = ? AND date = ?',
    [data.employeeId, data.date]
  );

  if (existing) {
    throw new Error('该员工当天已有缺勤记录');
  }

  const now = new Date().toISOString();
  const id = uuidv4();

  await runAsync(
    `INSERT INTO absences 
     (id, employee_id, date, type, reason, hours, approved_by, approved_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, data.employeeId, data.date, data.type,
      data.reason || null, data.hours, operatorId, now, now
    ]
  );

  const absence = await getAsync(
    `SELECT 
      id, employee_id as employeeId, date, type,
      reason, hours, approved_by as approvedBy,
      approved_at as approvedAt, created_at as createdAt
     FROM absences WHERE id = ?`,
    [id]
  );

  await recordHistory('CREATE', 'absence', id, operatorId, operatorName, null, absence, '创建缺勤记录');

  return absence!;
};
