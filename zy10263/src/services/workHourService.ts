import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync } from '../database/connection';
import { WorkHour } from '../types';
import { recordHistory } from './historyService';
import { checkAbsenceBeforeWorkHour, checkDuplicateWorkHour, ValidationError } from '../utils/validation';

export const getWorkHours = async (employeeId?: string, date?: string): Promise<WorkHour[]> => {
  let sql = `
    SELECT 
      id, employee_id as employeeId, line_id as lineId,
      swap_request_id as swapRequestId, date, hours,
      confirmed_by as confirmedBy, confirmed_at as confirmedAt,
      status, created_at as createdAt
     FROM work_hours
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

export const createWorkHour = async (
  data: {
    employeeId: string;
    lineId: string;
    swapRequestId?: string;
    date: string;
    hours: number;
  },
  operatorId: string,
  operatorName: string
): Promise<WorkHour> => {
  const absenceCheck = await checkAbsenceBeforeWorkHour(data.employeeId, data.date, data.hours);
  if (absenceCheck.hasAbsence) {
    throw new ValidationError(
      'ABSENCE_EXISTS',
      '该员工当天有缺勤记录，请先处理缺勤',
      { absenceHours: absenceCheck.absenceHours }
    );
  }

  const duplicateCheck = await checkDuplicateWorkHour(
    data.employeeId,
    data.lineId,
    data.date,
    data.swapRequestId || null
  );
  if (duplicateCheck.isDuplicate) {
    throw new ValidationError(
      'DUPLICATE_WORK_HOUR',
      '相同的工时记录已存在',
      { existingWorkHour: duplicateCheck.existingWorkHour }
    );
  }

  const now = new Date().toISOString();
  const id = uuidv4();

  await runAsync(
    `INSERT INTO work_hours 
     (id, employee_id, line_id, swap_request_id, date, hours, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)`,
    [
      id, data.employeeId, data.lineId, data.swapRequestId || null,
      data.date, data.hours, now
    ]
  );

  const workHour = await getAsync(
    `SELECT 
      id, employee_id as employeeId, line_id as lineId,
      swap_request_id as swapRequestId, date, hours,
      confirmed_by as confirmedBy, confirmed_at as confirmedAt,
      status, created_at as createdAt
     FROM work_hours WHERE id = ?`,
    [id]
  );

  await recordHistory('CREATE', 'work_hour', id, operatorId, operatorName, null, workHour, '创建工时记录');

  return workHour!;
};

export const confirmWorkHour = async (
  workHourId: string,
  operatorId: string,
  operatorName: string
): Promise<WorkHour> => {
  const before = await getAsync(
    `SELECT 
      id, employee_id as employeeId, line_id as lineId,
      swap_request_id as swapRequestId, date, hours,
      confirmed_by as confirmedBy, confirmed_at as confirmedAt,
      status, created_at as createdAt
     FROM work_hours WHERE id = ?`,
    [workHourId]
  );

  if (!before) {
    throw new ValidationError('WORK_HOUR_NOT_FOUND', '工时记录不存在');
  }

  if (before.status === 'confirmed') {
    throw new ValidationError('ALREADY_CONFIRMED', '该工时记录已确认');
  }

  const now = new Date().toISOString();
  await runAsync(
    `UPDATE work_hours 
     SET status = 'confirmed', confirmed_by = ?, confirmed_at = ?
     WHERE id = ?`,
    [operatorId, now, workHourId]
  );

  const after = await getAsync(
    `SELECT 
      id, employee_id as employeeId, line_id as lineId,
      swap_request_id as swapRequestId, date, hours,
      confirmed_by as confirmedBy, confirmed_at as confirmedAt,
      status, created_at as createdAt
     FROM work_hours WHERE id = ?`,
    [workHourId]
  );

  await recordHistory('CONFIRM', 'work_hour', workHourId, operatorId, operatorName, before, after, '确认工时记录');

  return after!;
};
