import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync } from '../database/connection';
import { Performance } from '../types';
import { recordHistory } from './historyService';

export const getPerformances = async (employeeId?: string, month?: string): Promise<Performance[]> => {
  let sql = `
    SELECT 
      id, employee_id as employeeId, line_id as lineId,
      month, total_hours as totalHours, normal_hours as normalHours,
      overtime_hours as overtimeHours, absence_hours as absenceHours,
      efficiency, quality_rate as qualityRate, calculated_at as calculatedAt
     FROM performances
  `;
  const params: any[] = [];
  const conditions: string[] = [];

  if (employeeId) {
    conditions.push('employee_id = ?');
    params.push(employeeId);
  }
  if (month) {
    conditions.push('month = ?');
    params.push(month);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY month DESC, calculatedAt DESC';

  return allAsync(sql, params);
};

export const calculatePerformance = async (
  employeeId: string,
  lineId: string,
  month: string,
  operatorId: string,
  operatorName: string
): Promise<Performance> => {
  const workHours = await allAsync(
    `SELECT SUM(hours) as total, 
            SUM(CASE WHEN strftime('%H', date) >= '18' THEN hours ELSE 0 END) as overtime
     FROM work_hours
     WHERE employee_id = ? AND line_id = ? AND strftime('%Y-%m', date) = ? AND status = 'confirmed'`,
    [employeeId, lineId, month]
  );

  const absences = await allAsync(
    `SELECT SUM(hours) as total
     FROM absences
     WHERE employee_id = ? AND strftime('%Y-%m', date) = ?`,
    [employeeId, month]
  );

  const totalHours = workHours[0]?.total || 0;
  const overtimeHours = workHours[0]?.overtime || 0;
  const normalHours = totalHours - overtimeHours;
  const absenceHours = absences[0]?.total || 0;

  const efficiency = totalHours > 160 ? 100 : (totalHours / 160) * 100;
  const qualityRate = 95 + Math.random() * 5;

  const now = new Date().toISOString();

  const existing = await getAsync(
    'SELECT id FROM performances WHERE employee_id = ? AND line_id = ? AND month = ?',
    [employeeId, lineId, month]
  );

  let id: string;
  if (existing) {
    id = existing.id;
    const before = await getPerformanceById(id);

    await runAsync(
      `UPDATE performances 
       SET total_hours = ?, normal_hours = ?, overtime_hours = ?, 
           absence_hours = ?, efficiency = ?, quality_rate = ?, calculated_at = ?
       WHERE id = ?`,
      [totalHours, normalHours, overtimeHours, absenceHours, efficiency, qualityRate, now, id]
    );

    const after = await getPerformanceById(id);
    await recordHistory('UPDATE', 'performance', id, operatorId, operatorName, before, after, '更新绩效数据');
  } else {
    id = uuidv4();
    await runAsync(
      `INSERT INTO performances 
       (id, employee_id, line_id, month, total_hours, normal_hours, 
        overtime_hours, absence_hours, efficiency, quality_rate, calculated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, employeeId, lineId, month, totalHours, normalHours, overtimeHours, absenceHours, efficiency, qualityRate, now]
    );

    const performance = await getPerformanceById(id);
    await recordHistory('CREATE', 'performance', id, operatorId, operatorName, null, performance, '创建绩效数据');
  }

  const result = await getPerformanceById(id);
  if (!result) {
    throw new Error('计算绩效失败');
  }
  return result;
};

export const getPerformanceById = async (id: string): Promise<Performance | undefined> => {
  return getAsync(
    `SELECT 
      id, employee_id as employeeId, line_id as lineId,
      month, total_hours as totalHours, normal_hours as normalHours,
      overtime_hours as overtimeHours, absence_hours as absenceHours,
      efficiency, quality_rate as qualityRate, calculated_at as calculatedAt
     FROM performances WHERE id = ?`,
    [id]
  );
};
