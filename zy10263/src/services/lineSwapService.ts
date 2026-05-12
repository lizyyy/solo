import { v4 as uuidv4 } from 'uuid';
import { runAsync, getAsync, allAsync } from '../database/connection';
import { LineSwapRequest } from '../types';
import { recordHistory } from './historyService';
import { 
  checkSkillMatch, 
  checkEmployeeLineConflict, 
  checkDuplicateRequest,
  ValidationError 
} from '../utils/validation';
import { getEmployeeById, updateEmployeeLine } from './employeeService';

const generateRequestNo = (): string => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `SW${dateStr}${random}`;
};

export const getSwapRequests = async (status?: string): Promise<LineSwapRequest[]> => {
  let sql = `
    SELECT 
      id, request_no as requestNo, employee_id as employeeId,
      from_line_id as fromLineId, to_line_id as toLineId,
      reason, requested_by as requestedBy, requested_at as requestedAt,
      status, approved_by as approvedBy, approved_at as approvedAt,
      start_time as startTime, end_time as endTime, skill_match as skillMatch,
      created_at as createdAt, updated_at as updatedAt
     FROM line_swap_requests
  `;
  const params: any[] = [];

  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }

  sql += ' ORDER BY created_at DESC';

  const rows = await allAsync(sql, params);
  return rows.map(row => ({
    ...row,
    skillMatch: Boolean(row.skillMatch)
  }));
};

export const getSwapRequestById = async (id: string): Promise<LineSwapRequest | undefined> => {
  const row = await getAsync(
    `SELECT 
      id, request_no as requestNo, employee_id as employeeId,
      from_line_id as fromLineId, to_line_id as toLineId,
      reason, requested_by as requestedBy, requested_at as requestedAt,
      status, approved_by as approvedBy, approved_at as approvedAt,
      start_time as startTime, end_time as endTime, skill_match as skillMatch,
      created_at as createdAt, updated_at as updatedAt
     FROM line_swap_requests WHERE id = ?`,
    [id]
  );

  if (row) {
    row.skillMatch = Boolean(row.skillMatch);
  }
  return row;
};

export const createSwapRequest = async (
  data: {
    employeeId: string;
    fromLineId: string | null;
    toLineId: string;
    reason: string;
    startTime: string;
    endTime?: string;
    allowSkillMismatch?: boolean;
  },
  operatorId: string,
  operatorName: string
): Promise<LineSwapRequest> => {
  const employee = await getEmployeeById(data.employeeId);
  if (!employee) {
    throw new ValidationError('EMPLOYEE_NOT_FOUND', '员工不存在');
  }

  const duplicateCheck = await checkDuplicateRequest(
    data.employeeId,
    data.fromLineId,
    data.toLineId,
    data.startTime
  );
  if (duplicateCheck.isDuplicate) {
    throw new ValidationError(
      'DUPLICATE_REQUEST',
      '同一员工同一天相同产线的换线申请已存在',
      { existingRequest: duplicateCheck.existingRequest }
    );
  }

  const conflictCheck = await checkEmployeeLineConflict(
    data.employeeId,
    data.startTime,
    data.endTime || null
  );
  if (conflictCheck.hasConflict) {
    throw new ValidationError(
      'LINE_CONFLICT',
      '员工在该时间段已有已批准的换线安排',
      { conflictRequests: conflictCheck.conflictRequests }
    );
  }

  const skillCheck = await checkSkillMatch(data.employeeId, data.toLineId);

  if (!skillCheck.matched && !data.allowSkillMismatch) {
    throw new ValidationError(
      'SKILL_MISMATCH',
      '员工技能不匹配目标产线要求，如需强制换线请设置 allowSkillMismatch=true',
      {
        employeeSkills: skillCheck.employeeSkills,
        requiredSkill: skillCheck.requiredSkill,
        hint: '可通过设置 allowSkillMismatch=true 强制提交（需管理员审批）'
      }
    );
  }

  const now = new Date().toISOString();
  const id = uuidv4();
  const requestNo = generateRequestNo();

  await runAsync(
    `INSERT INTO line_swap_requests 
     (id, request_no, employee_id, from_line_id, to_line_id, reason, requested_by, requested_at, 
      status, start_time, end_time, skill_match, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, requestNo, data.employeeId, data.fromLineId, data.toLineId,
      data.reason, operatorId, now,
      !skillCheck.matched ? 'pending_approval' : 'pending',
      data.startTime,
      data.endTime || null, skillCheck.matched ? 1 : 0, now, now
    ]
  );

  const request = await getSwapRequestById(id);
  await recordHistory(
    'CREATE',
    'line_swap_request',
    id,
    operatorId,
    operatorName,
    null,
    request,
    skillCheck.matched ? '创建换线申请' : '创建换线申请（技能不匹配，需额外审批）'
  );

  return request!;
};

export const approveSwapRequest = async (
  requestId: string,
  operatorId: string,
  operatorName: string
): Promise<LineSwapRequest> => {
  const before = await getSwapRequestById(requestId);
  if (!before) {
    throw new ValidationError('REQUEST_NOT_FOUND', '换线申请不存在');
  }

  if (!['pending', 'pending_approval'].includes(before.status)) {
    throw new ValidationError(
      'INVALID_STATUS',
      '只有待审批的申请可以审批',
      { currentStatus: before.status, allowedStatuses: ['pending', 'pending_approval'] }
    );
  }

  const now = new Date().toISOString();
  await runAsync(
    `UPDATE line_swap_requests 
     SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = ?
     WHERE id = ?`,
    [operatorId, now, now, requestId]
  );

  await updateEmployeeLine(before.employeeId, before.toLineId, operatorId, operatorName);

  const after = await getSwapRequestById(requestId);
  await recordHistory(
    'APPROVE',
    'line_swap_request',
    requestId,
    operatorId,
    operatorName,
    before,
    after,
    '审批通过换线申请'
  );

  return after!;
};

export const rejectSwapRequest = async (
  requestId: string,
  reason: string,
  operatorId: string,
  operatorName: string
): Promise<LineSwapRequest> => {
  const before = await getSwapRequestById(requestId);
  if (!before) {
    throw new ValidationError('REQUEST_NOT_FOUND', '换线申请不存在');
  }

  if (before.status !== 'pending') {
    throw new ValidationError(
      'INVALID_STATUS',
      '只有待审批的申请可以拒绝',
      { currentStatus: before.status }
    );
  }

  const now = new Date().toISOString();
  await runAsync(
    `UPDATE line_swap_requests 
     SET status = 'rejected', approved_by = ?, approved_at = ?, updated_at = ?
     WHERE id = ?`,
    [operatorId, now, now, requestId]
  );

  const after = await getSwapRequestById(requestId);
  await recordHistory(
    'REJECT',
    'line_swap_request',
    requestId,
    operatorId,
    operatorName,
    before,
    after,
    `拒绝换线申请: ${reason}`
  );

  return after!;
};
