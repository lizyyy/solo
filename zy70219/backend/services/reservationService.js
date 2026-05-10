const db = require('../config/db');
const conflictService = require('./conflictService');
const historyService = require('./historyService');

const reservationStatuses = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed'
};

const equipmentBookingStatuses = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled'
};

function isValidStatusTransition(currentStatus, newStatus) {
  const transitions = {
    draft: ['submitted', 'cancelled'],
    submitted: ['approved', 'rejected', 'draft'],
    approved: ['in_progress', 'cancelled'],
    rejected: ['draft'],
    in_progress: ['completed'],
    completed: [],
    cancelled: []
  };
  return transitions[currentStatus]?.includes(newStatus) || false;
}

function createReservation(data) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO reservations (kitchen_id, team_id, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?)`,
      [data.kitchen_id, data.team_id, data.start_time, data.end_time, reservationStatuses.DRAFT],
      async function(err) {
        if (err) reject(err);
        else {
          const reservationId = this.lastID;
          await historyService.logHistory(
            historyService.entityTypes.RESERVATION,
            reservationId,
            historyService.actions.CREATE,
            null,
            { status: reservationStatuses.DRAFT, ...data }
          );
          resolve(reservationId);
        }
      }
    );
  });
}

function getReservation(id) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT r.*, k.name as kitchen_name, k.capacity, t.name as team_name,
              (SELECT COUNT(*) FROM equipment_bookings eb WHERE eb.reservation_id = r.id AND eb.status != 'cancelled') as equipment_count
       FROM reservations r
       JOIN kitchens k ON r.kitchen_id = k.id
       JOIN teams t ON r.team_id = t.id
       WHERE r.id = ?`,
      [id],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

function getAllReservations(filters = {}) {
  return new Promise((resolve, reject) => {
    let sql = `SELECT r.*, k.name as kitchen_name, k.capacity, t.name as team_name,
               (SELECT COUNT(*) FROM equipment_bookings eb WHERE eb.reservation_id = r.id AND eb.status != 'cancelled') as equipment_count
               FROM reservations r
               JOIN kitchens k ON r.kitchen_id = k.id
               JOIN teams t ON r.team_id = t.id
               WHERE 1=1`;
    const params = [];
    
    if (filters.status) {
      sql += ` AND r.status = ?`;
      params.push(filters.status);
    }
    if (filters.kitchen_id) {
      sql += ` AND r.kitchen_id = ?`;
      params.push(filters.kitchen_id);
    }
    sql += ` ORDER BY r.start_time DESC`;
    
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function submitReservation(id) {
  const reservation = await getReservation(id);
  
  if (!reservation) {
    throw new Error('预约记录不存在');
  }
  
  if (reservation.status === reservationStatuses.SUBMITTED) {
    throw new Error('重复提交：预约已在审批流程中');
  }
  
  if (!isValidStatusTransition(reservation.status, reservationStatuses.SUBMITTED)) {
    throw new Error(`状态冲突：不能从 ${reservation.status} 提交预约`);
  }

  const equipmentBookings = await new Promise((resolve, reject) => {
    db.all(
      `SELECT eb.*, e.name as equipment_name, e.kitchen_id
       FROM equipment_bookings eb
       JOIN equipments e ON eb.equipment_id = e.id
       WHERE eb.reservation_id = ? AND eb.status != 'cancelled'`,
      [id],
      (err, rows) => { if (err) reject(err); else resolve(rows); }
    );
  });

  if (equipmentBookings.length === 0) {
    throw new Error('来源记录缺失：请先选择要使用的设备');
  }

  const allConflicts = [];
  const allSuggestions = [];

  for (const booking of equipmentBookings) {
    const conflictResult = await conflictService.checkAllConflicts({
      id,
      kitchen_id: reservation.kitchen_id,
      equipment_id: booking.equipment_id,
      equipment_name: booking.equipment_name,
      start_time: booking.start_time,
      end_time: booking.end_time
    });
    
    if (conflictResult.hasConflicts) {
      allConflicts.push(...conflictResult.conflicts);
      allSuggestions.push(...conflictResult.suggestions);
    }
  }

  const oldStatus = reservation.status;
  await new Promise((resolve, reject) => {
    db.run(
      `UPDATE reservations SET status = ? WHERE id = ?`,
      [reservationStatuses.SUBMITTED, id],
      err => { if (err) reject(err); else resolve(); }
    );
  });

  await historyService.logHistory(
    historyService.entityTypes.RESERVATION,
    id,
    historyService.actions.SUBMIT,
    { status: oldStatus },
    { status: reservationStatuses.SUBMITTED }
  );

  return {
    success: true,
    conflicts: allConflicts,
    suggestions: [...new Set(allSuggestions.map(s => JSON.stringify(s)))].map(s => JSON.parse(s))
  };
}

async function approveReservation(id, approver, comments = '') {
  const reservation = await getReservation(id);
  
  if (!reservation) {
    throw new Error('来源记录缺失：预约记录不存在');
  }
  
  if (!isValidStatusTransition(reservation.status, reservationStatuses.APPROVED)) {
    throw new Error(`状态冲突：不能从 ${reservation.status} 批准预约`);
  }

  const oldStatus = reservation.status;
  
  await new Promise((resolve, reject) => {
    db.run(
      `UPDATE reservations SET status = ? WHERE id = ?`,
      [reservationStatuses.APPROVED, id],
      err => { if (err) reject(err); else resolve(); }
    );
  });

  await new Promise((resolve, reject) => {
    db.run(
      `UPDATE equipment_bookings SET status = ? WHERE reservation_id = ? AND status = ?`,
      [equipmentBookingStatuses.CONFIRMED, id, equipmentBookingStatuses.PENDING],
      err => { if (err) reject(err); else resolve(); }
    );
  });

  await historyService.logHistory(
    historyService.entityTypes.RESERVATION,
    id,
    historyService.actions.APPROVE,
    { status: oldStatus },
    { status: reservationStatuses.APPROVED, approver, comments }
  );

  return { success: true };
}

async function rejectReservation(id, approver, comments = '') {
  const reservation = await getReservation(id);
  
  if (!reservation) {
    throw new Error('来源记录缺失：预约记录不存在');
  }
  
  if (!isValidStatusTransition(reservation.status, reservationStatuses.REJECTED)) {
    throw new Error(`状态冲突：不能从 ${reservation.status} 驳回预约`);
  }

  const oldStatus = reservation.status;
  
  await new Promise((resolve, reject) => {
    db.run(
      `UPDATE reservations SET status = ? WHERE id = ?`,
      [reservationStatuses.REJECTED, id],
      err => { if (err) reject(err); else resolve(); }
    );
  });

  await historyService.logHistory(
    historyService.entityTypes.RESERVATION,
    id,
    historyService.actions.REJECT,
    { status: oldStatus },
    { status: reservationStatuses.REJECTED, approver, comments }
  );

  return { success: true };
}

function getBlockPoints(reservation, conflicts = []) {
  const blockPoints = [];
  
  if (reservation.status === reservationStatuses.DRAFT) {
    blockPoints.push({
      type: 'action_required',
      title: '待提交',
      description: '预约处于草稿状态，完善设备选择后可提交审批',
      priority: 'low'
    });
  }
  
  if (reservation.status === reservationStatuses.SUBMITTED) {
    if (conflicts.length > 0) {
      const highPriorityConflicts = conflicts.filter(c => 
        c.type === conflictService.conflictTypes.EQUIPMENT_OVERLAP ||
        c.type === conflictService.conflictTypes.CLEANING_OVERLAP ||
        c.type === conflictService.conflictTypes.FIRE_INSPECTION_OVERLAP
      );
      
      blockPoints.push({
        type: 'conflict',
        title: highPriorityConflicts.length > 0 ? '高优先级冲突' : '存在冲突',
        description: conflicts.map(c => c.message).join('; '),
        details: conflicts,
        priority: highPriorityConflicts.length > 0 ? 'high' : 'medium'
      });
    }
    
    blockPoints.push({
      type: 'approval_pending',
      title: '待审批',
      description: '预约已提交，等待管理员审批',
      priority: 'medium'
    });
  }
  
  if (reservation.status === reservationStatuses.APPROVED) {
    blockPoints.push({
      type: 'ready',
      title: '已批准',
      description: '预约已通过审批，设备已锁定',
      priority: 'low'
    });
  }
  
  if (reservation.status === reservationStatuses.REJECTED) {
    blockPoints.push({
      type: 'rejected',
      title: '已驳回',
      description: '预约被驳回，请修改后重新提交',
      priority: 'medium'
    });
  }
  
  return blockPoints;
}

module.exports = {
  reservationStatuses,
  equipmentBookingStatuses,
  isValidStatusTransition,
  createReservation,
  getReservation,
  getAllReservations,
  submitReservation,
  approveReservation,
  rejectReservation,
  getBlockPoints
};
