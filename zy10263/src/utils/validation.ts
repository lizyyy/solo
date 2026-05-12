import { getAsync, allAsync } from '../database/connection';

export const ValidationError = class extends Error {
  code: string;
  details: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'ValidationError';
  }
};

export const checkSkillMatch = async (
  employeeId: string,
  toLineId: string
): Promise<{ matched: boolean; employeeSkills: string[]; requiredSkill: string | null }> => {
  const line = await getAsync(
    'SELECT required_skill_id as requiredSkillId FROM production_lines WHERE id = ?',
    [toLineId]
  );

  if (!line) {
    throw new ValidationError('LINE_NOT_FOUND', '目标产线不存在');
  }

  const employeeSkills = await allAsync(
    'SELECT s.code FROM employee_skills es JOIN skills s ON es.skill_id = s.id WHERE es.employee_id = ?',
    [employeeId]
  );

  const skillCodes = employeeSkills.map(s => s.code);
  const requiredSkill = await getAsync(
    'SELECT code FROM skills WHERE id = ?',
    [line.requiredSkillId]
  );

  const matched = requiredSkill ? skillCodes.includes(requiredSkill.code) : false;

  return {
    matched,
    employeeSkills: skillCodes,
    requiredSkill: requiredSkill?.code || null
  };
};

export const checkEmployeeLineConflict = async (
  employeeId: string,
  startTime: string,
  endTime: string | null
): Promise<{ hasConflict: boolean; conflictRequests: any[] }> => {
  const pendingOrApprovedRequests = await allAsync(
    `SELECT id, request_no as requestNo, from_line_id as fromLineId, to_line_id as toLineId, 
            start_time as startTime, end_time as endTime, status
     FROM line_swap_requests
     WHERE employee_id = ? 
       AND status IN ('pending', 'approved')
       AND (end_time IS NULL OR end_time >= ?)`,
    [employeeId, startTime]
  );

  const conflictRequests = pendingOrApprovedRequests.filter(req => {
    if (req.status !== 'approved') return false;
    if (!endTime) return true;
    return req.startTime <= endTime && (req.endTime === null || req.endTime >= startTime);
  });

  return {
    hasConflict: conflictRequests.length > 0,
    conflictRequests
  };
};

export const checkDuplicateRequest = async (
  employeeId: string,
  fromLineId: string | null,
  toLineId: string,
  startTime: string
): Promise<{ isDuplicate: boolean; existingRequest: any | null }> => {
  const existingRequest = await getAsync(
    `SELECT id, request_no as requestNo, status, created_at as createdAt
     FROM line_swap_requests
     WHERE employee_id = ? 
       AND (from_line_id = ? OR (from_line_id IS NULL AND ? IS NULL))
       AND to_line_id = ?
       AND DATE(start_time) = DATE(?)
       AND status IN ('pending', 'approved')`,
    [employeeId, fromLineId, fromLineId, toLineId, startTime]
  );

  return {
    isDuplicate: !!existingRequest,
    existingRequest: existingRequest || null
  };
};

export const checkAbsenceBeforeWorkHour = async (
  employeeId: string,
  date: string,
  hours: number
): Promise<{ hasAbsence: boolean; absenceHours: number }> => {
  const absence = await getAsync(
    'SELECT hours FROM absences WHERE employee_id = ? AND date = ?',
    [employeeId, date]
  );

  if (!absence) {
    return { hasAbsence: false, absenceHours: 0 };
  }

  return {
    hasAbsence: true,
    absenceHours: absence.hours
  };
};

export const checkDuplicateWorkHour = async (
  employeeId: string,
  lineId: string,
  date: string,
  swapRequestId: string | null
): Promise<{ isDuplicate: boolean; existingWorkHour: any | null }> => {
  const existingWorkHour = await getAsync(
    `SELECT id, hours, status, created_at as createdAt
     FROM work_hours
     WHERE employee_id = ? 
       AND line_id = ? 
       AND date = ?
       AND (swap_request_id = ? OR (swap_request_id IS NULL AND ? IS NULL))`,
    [employeeId, lineId, date, swapRequestId, swapRequestId]
  );

  return {
    isDuplicate: !!existingWorkHour,
    existingWorkHour: existingWorkHour || null
  };
};
