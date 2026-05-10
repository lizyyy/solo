import db from '../db';
import { generateId, nowISO } from '../utils';
import { checkReservationConflicts } from './conflict-service';
import { logAction } from './log-service';
import { Reservation, ReservationWithDetails, ReservationStatus } from '../types';

export interface CreateReservationInput {
  microscopeId: string;
  userId: string;
  groupId: string;
  startTime: string;
  endTime: string;
  purpose: string;
  accessoryIds: string[];
}

export interface UpdateReservationInput {
  startTime?: string;
  endTime?: string;
  purpose?: string;
  accessoryIds?: string[];
}

export class ReservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReservationError';
  }
}

export class ConflictError extends ReservationError {
  conflicts: any[];
  constructor(message: string, conflicts: any[]) {
    super(message);
    this.name = 'ConflictError';
    this.conflicts = conflicts;
  }
}

export class StateTransitionError extends ReservationError {
  constructor(message: string) {
    super(message);
    this.name = 'StateTransitionError';
  }
}

function validateReservationTimes(startTime: string, endTime: string): void {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime())) {
    throw new ReservationError('开始时间格式无效');
  }

  if (isNaN(end.getTime())) {
    throw new ReservationError('结束时间格式无效');
  }

  if (start >= end) {
    throw new ReservationError('结束时间必须晚于开始时间');
  }

  if (end.getTime() - start.getTime() < 30 * 60 * 1000) {
    throw new ReservationError('预约时长至少为30分钟');
  }

  if (end.getTime() - start.getTime() > 24 * 60 * 60 * 1000) {
    throw new ReservationError('单次预约不能超过24小时');
  }
}

function getReservationById(id: string): Reservation | undefined {
  return db.prepare(`
    SELECT * FROM reservations WHERE id = ?
  `).get(id) as Reservation | undefined;
}

function getReservationAccessories(reservationId: string): any[] {
  return db.prepare(`
    SELECT a.* FROM accessories a
    JOIN reservation_accessories ra ON a.id = ra.accessory_id
    WHERE ra.reservation_id = ?
  `).all(reservationId) as any[];
}

export function createReservation(
  input: CreateReservationInput,
  userId: string
): ReservationWithDetails {
  validateReservationTimes(input.startTime, input.endTime);

  const conflictResult = checkReservationConflicts(
    input.microscopeId,
    input.accessoryIds,
    input.startTime,
    input.endTime
  );

  if (conflictResult.hasConflict) {
    throw new ConflictError(
      `发现 ${conflictResult.conflicts.length} 个资源冲突`,
      conflictResult.conflicts
    );
  }

  const reservationId = generateId();
  const now = nowISO();

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO reservations (
        id, microscope_id, user_id, group_id, start_time, end_time,
        purpose, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reservationId,
      input.microscopeId,
      input.userId,
      input.groupId,
      input.startTime,
      input.endTime,
      input.purpose,
      'pending',
      now,
      now
    );

    const insertAccessory = db.prepare(`
      INSERT INTO reservation_accessories (id, reservation_id, accessory_id, created_at)
      VALUES (?, ?, ?, ?)
    `);

    for (const accessoryId of input.accessoryIds) {
      insertAccessory.run(generateId(), reservationId, accessoryId, now);
    }
  });

  transaction();

  logAction({
    entityType: 'reservation',
    entityId: reservationId,
    action: 'create',
    newValues: {
      microscopeId: input.microscopeId,
      userId: input.userId,
      groupId: input.groupId,
      startTime: input.startTime,
      endTime: input.endTime,
      purpose: input.purpose,
      accessoryIds: input.accessoryIds
    },
    userId
  });

  return getReservationWithDetails(reservationId)!;
}

export function updateReservation(
  id: string,
  input: UpdateReservationInput,
  userId: string
): ReservationWithDetails {
  const existing = getReservationById(id);
  if (!existing) {
    throw new ReservationError('预约记录不存在');
  }

  if (existing.status === 'approved' || existing.status === 'rejected' || existing.status === 'cancelled') {
    throw new StateTransitionError(
      `状态为"${getStatusLabel(existing.status)}"的预约不能修改`
    );
  }

  const newStartTime = input.startTime || existing.start_time;
  const newEndTime = input.endTime || existing.end_time;
  const newAccessoryIds = input.accessoryIds || getReservationAccessories(id).map(a => a.id);

  validateReservationTimes(newStartTime, newEndTime);

  const conflictResult = checkReservationConflicts(
    existing.microscope_id,
    newAccessoryIds,
    newStartTime,
    newEndTime,
    id
  );

  if (conflictResult.hasConflict) {
    throw new ConflictError(
      `修改后发现 ${conflictResult.conflicts.length} 个资源冲突`,
      conflictResult.conflicts
    );
  }

  const now = nowISO();
  const oldValues = { ...existing };

  const transaction = db.transaction(() => {
    const updates: string[] = [];
    const params: any[] = [];

    if (input.startTime) {
      updates.push('start_time = ?');
      params.push(input.startTime);
    }
    if (input.endTime) {
      updates.push('end_time = ?');
      params.push(input.endTime);
    }
    if (input.purpose !== undefined) {
      updates.push('purpose = ?');
      params.push(input.purpose);
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    if (updates.length > 1) {
      db.prepare(`
        UPDATE reservations SET ${updates.join(', ')} WHERE id = ?
      `).run(...params);
    }

    if (input.accessoryIds) {
      db.prepare(`
        DELETE FROM reservation_accessories WHERE reservation_id = ?
      `).run(id);

      const insertAccessory = db.prepare(`
        INSERT INTO reservation_accessories (id, reservation_id, accessory_id, created_at)
        VALUES (?, ?, ?, ?)
      `);

      for (const accessoryId of input.accessoryIds) {
        insertAccessory.run(generateId(), id, accessoryId, now);
      }
    }
  });

  transaction();

  logAction({
    entityType: 'reservation',
    entityId: id,
    action: 'update',
    oldValues,
    newValues: input,
    userId
  });

  return getReservationWithDetails(id)!;
}

export function submitReservation(id: string, userId: string): ReservationWithDetails {
  const existing = getReservationById(id);
  if (!existing) {
    throw new ReservationError('预约记录不存在');
  }

  if (existing.status !== 'pending') {
    throw new StateTransitionError(
      `只有"待提交"状态的预约才能提交审批`
    );
  }

  const now = nowISO();

  db.prepare(`
    UPDATE reservations SET status = ?, submitted_at = ?, updated_at = ? WHERE id = ?
  `).run('pending', now, now, id);

  logAction({
    entityType: 'reservation',
    entityId: id,
    action: 'submit',
    oldValues: { status: existing.status },
    newValues: { status: 'pending' },
    userId
  });

  return getReservationWithDetails(id)!;
}

export function approveReservation(
  id: string,
  approverId: string,
  note?: string
): ReservationWithDetails {
  const existing = getReservationById(id);
  if (!existing) {
    throw new ReservationError('预约记录不存在');
  }

  if (existing.status !== 'pending') {
    throw new StateTransitionError(
      `只有"待审批"状态的预约才能批准`
    );
  }

  const conflictResult = checkReservationConflicts(
    existing.microscope_id,
    getReservationAccessories(id).map(a => a.id),
    existing.start_time,
    existing.end_time,
    id
  );

  if (conflictResult.hasConflict) {
    throw new ConflictError(
      `审批时发现 ${conflictResult.conflicts.length} 个资源冲突`,
      conflictResult.conflicts
    );
  }

  const now = nowISO();

  db.prepare(`
    UPDATE reservations SET 
      status = ?, approved_at = ?, approved_by = ?, updated_at = ? 
    WHERE id = ?
  `).run('approved', now, approverId, now, id);

  logAction({
    entityType: 'reservation',
    entityId: id,
    action: 'approve',
    oldValues: { status: existing.status },
    newValues: { status: 'approved', approvedBy: approverId },
    userId: approverId,
    note
  });

  return getReservationWithDetails(id)!;
}

export function rejectReservation(
  id: string,
  approverId: string,
  reason: string
): ReservationWithDetails {
  const existing = getReservationById(id);
  if (!existing) {
    throw new ReservationError('预约记录不存在');
  }

  if (existing.status !== 'pending') {
    throw new StateTransitionError(
      `只有"待审批"状态的预约才能拒绝`
    );
  }

  const now = nowISO();

  db.prepare(`
    UPDATE reservations SET 
      status = ?, rejected_at = ?, rejection_reason = ?, updated_at = ? 
    WHERE id = ?
  `).run('rejected', now, reason, now, id);

  logAction({
    entityType: 'reservation',
    entityId: id,
    action: 'reject',
    oldValues: { status: existing.status },
    newValues: { status: 'rejected', reason },
    userId: approverId
  });

  return getReservationWithDetails(id)!;
}

export function cancelReservation(id: string, userId: string, reason?: string): ReservationWithDetails {
  const existing = getReservationById(id);
  if (!existing) {
    throw new ReservationError('预约记录不存在');
  }

  if (existing.status === 'rejected' || existing.status === 'cancelled') {
    throw new StateTransitionError(
      `该预约已处于"${getStatusLabel(existing.status)}"状态，无需取消`
    );
  }

  const now = nowISO();

  db.prepare(`
    UPDATE reservations SET 
      status = ?, cancelled_at = ?, updated_at = ? 
    WHERE id = ?
  `).run('cancelled', now, now, id);

  logAction({
    entityType: 'reservation',
    entityId: id,
    action: 'cancel',
    oldValues: { status: existing.status },
    newValues: { status: 'cancelled', reason },
    userId
  });

  return getReservationWithDetails(id)!;
}

export function deleteReservation(id: string, userId: string): void {
  const existing = getReservationById(id);
  if (!existing) {
    return;
  }

  if (existing.status === 'approved') {
    throw new StateTransitionError('已批准的预约不能删除，请先取消');
  }

  db.prepare(`DELETE FROM reservations WHERE id = ?`).run(id);

  logAction({
    entityType: 'reservation',
    entityId: id,
    action: 'delete',
    oldValues: existing,
    userId
  });
}

export function getReservationWithDetails(id: string): ReservationWithDetails | undefined {
  const reservation = db.prepare(`
    SELECT r.*,
           m.name as microscope_name,
           u.name as user_name,
           g.name as group_name
    FROM reservations r
    JOIN microscopes m ON r.microscope_id = m.id
    JOIN users u ON r.user_id = u.id
    JOIN research_groups g ON r.group_id = g.id
    WHERE r.id = ?
  `).get(id) as any;

  if (!reservation) return undefined;

  const accessories = getReservationAccessories(id);

  return {
    ...reservation,
    accessories
  } as ReservationWithDetails;
}

export function getAllReservations(filters?: {
  status?: ReservationStatus;
  microscopeId?: string;
  groupId?: string;
  startDate?: string;
  endDate?: string;
}): ReservationWithDetails[] {
  let query = `
    SELECT r.*,
           m.name as microscope_name,
           u.name as user_name,
           g.name as group_name
    FROM reservations r
    JOIN microscopes m ON r.microscope_id = m.id
    JOIN users u ON r.user_id = u.id
    JOIN research_groups g ON r.group_id = g.id
    WHERE 1=1
  `;

  const params: any[] = [];

  if (filters?.status) {
    query += ' AND r.status = ?';
    params.push(filters.status);
  }

  if (filters?.microscopeId) {
    query += ' AND r.microscope_id = ?';
    params.push(filters.microscopeId);
  }

  if (filters?.groupId) {
    query += ' AND r.group_id = ?';
    params.push(filters.groupId);
  }

  if (filters?.startDate) {
    query += ' AND date(r.start_time) >= date(?)';
    params.push(filters.startDate);
  }

  if (filters?.endDate) {
    query += ' AND date(r.start_time) <= date(?)';
    params.push(filters.endDate);
  }

  query += ' ORDER BY r.start_time DESC';

  const reservations = db.prepare(query).all(...params) as any[];

  return reservations.map(r => ({
    ...r,
    accessories: getReservationAccessories(r.id)
  })) as ReservationWithDetails[];
}

export function getStatusLabel(status: ReservationStatus): string {
  const labels: Record<ReservationStatus, string> = {
    draft: '草稿',
    pending: '待审批',
    approved: '已批准',
    rejected: '已拒绝',
    cancelled: '已取消',
    completed: '已完成'
  };
  return labels[status];
}
