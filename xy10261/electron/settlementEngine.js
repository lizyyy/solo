const { getDb } = require('./database');

function calculateHours(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end - start;
  const diffHours = diffMs / (1000 * 60 * 60);
  return Math.round(diffHours * 100) / 100;
}

function validateReservation(reservation) {
  const db = getDb();
  const errors = [];
  const verificationData = {};

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(reservation.member_id);
  if (!member) {
    errors.push('会员不存在');
    return { valid: false, errors, verificationData };
  }
  verificationData.member = member;

  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(reservation.room_id);
  if (!room) {
    errors.push('琴房不存在');
    return { valid: false, errors, verificationData };
  }
  verificationData.room = room;

  const start = new Date(reservation.scheduled_start);
  const end = new Date(reservation.scheduled_end);
  
  if (end <= start) {
    errors.push('结束时间必须晚于开始时间');
  }

  const scheduledHours = calculateHours(reservation.scheduled_start, reservation.scheduled_end);
  verificationData.scheduledHours = scheduledHours;

  if (member.remaining_hours < scheduledHours) {
    errors.push(`会员剩余时长不足。需要 ${scheduledHours} 小时，剩余 ${member.remaining_hours} 小时`);
  }

  const overlaps = db.prepare(`
    SELECT * FROM reservations 
    WHERE room_id = ? 
    AND status IN ('confirmed', 'in_progress', 'pending')
    AND id != ?
    AND (
      (scheduled_start < ? AND scheduled_end > ?) OR
      (scheduled_start < ? AND scheduled_end > ?) OR
      (scheduled_start >= ? AND scheduled_end <= ?)
    )
  `).get(
    reservation.room_id,
    reservation.id || 0,
    reservation.scheduled_end,
    reservation.scheduled_start,
    reservation.scheduled_start,
    reservation.scheduled_end,
    reservation.scheduled_start,
    reservation.scheduled_end
  );

  if (overlaps) {
    errors.push('该时间段已有预约');
    verificationData.overlapReservation = overlaps;
  }

  return {
    valid: errors.length === 0,
    errors,
    verificationData
  };
}

function validateAccessLog(accessLog, reservation) {
  const verificationData = {};
  const errors = [];

  if (accessLog.member_id !== reservation.member_id) {
    errors.push('进出记录会员ID与预约会员不匹配');
  }

  if (accessLog.room_id !== reservation.room_id) {
    errors.push('进出记录琴房ID与预约琴房不匹配');
  }

  const eventTime = new Date(accessLog.event_time);
  const scheduledStart = new Date(reservation.scheduled_start);
  const scheduledEnd = new Date(reservation.scheduled_end);

  if (accessLog.event_type === 'check_in') {
    if (eventTime < new Date(scheduledStart.getTime() - 30 * 60 * 1000)) {
      errors.push('签到时间过早（提前超过30分钟）');
    }
    if (eventTime > new Date(scheduledEnd.getTime() + 30 * 60 * 1000)) {
      errors.push('签到时间过晚（超过预约结束30分钟）');
    }
  }

  verificationData.accessLog = accessLog;
  verificationData.reservation = reservation;
  verificationData.timeChecks = {
    eventTime: accessLog.event_time,
    scheduledStart: reservation.scheduled_start,
    scheduledEnd: reservation.scheduled_end
  };

  return {
    valid: errors.length === 0,
    errors,
    verificationData
  };
}

function processSettlement(reservationId) {
  const db = getDb();
  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(reservationId);
  
  if (!reservation) {
    return {
      success: false,
      status: 'failed',
      error_message: '预约记录不存在',
      needsManualReview: false
    };
  }

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(reservation.member_id);
  if (!member) {
    return {
      success: false,
      status: 'failed',
      error_message: '会员信息缺失',
      needsManualReview: true
    };
  }

  const verificationData = {
    originalReservation: reservation,
    memberSnapshot: { ...member }
  };

  const accessLogs = db.prepare(`
    SELECT * FROM access_logs 
    WHERE reservation_id = ? 
    ORDER BY event_time ASC
  `).all(reservationId);

  verificationData.accessLogs = accessLogs;

  let actualStart = null;
  let actualEnd = null;

  for (const log of accessLogs) {
    if (log.event_type === 'check_in' && !actualStart) {
      actualStart = log.event_time;
    }
    if (log.event_type === 'check_out') {
      actualEnd = log.event_time;
    }
  }

  if (!actualStart || !actualEnd) {
    const errors = [];
    if (!actualStart) errors.push('缺少签到记录');
    if (!actualEnd) errors.push('缺少签出记录');
    
    return {
      success: false,
      status: 'needs_review',
      error_message: errors.join('；'),
      verificationData: JSON.stringify(verificationData),
      needsManualReview: true
    };
  }

  verificationData.timeCalculation = {
    actualStart,
    actualEnd,
    scheduledStart: reservation.scheduled_start,
    scheduledEnd: reservation.scheduled_end
  };

  const scheduledHours = calculateHours(reservation.scheduled_start, reservation.scheduled_end);
  const actualHours = calculateHours(actualStart, actualEnd);

  verificationData.hoursCalculation = {
    scheduledHours,
    actualHours
  };

  let packageDeduction = 0;
  let cashPayment = 0;
  let status = 'success';
  let errorMessage = null;
  let needsManualReview = false;

  const isExtended = reservation.is_extended === 1;
  let originalReservation = null;
  
  if (isExtended && reservation.original_reservation_id) {
    originalReservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(reservation.original_reservation_id);
    verificationData.originalReservation = originalReservation;
  }

  if (actualHours <= scheduledHours) {
    packageDeduction = actualHours;
  } else {
    const overtimeHours = actualHours - scheduledHours;
    packageDeduction = scheduledHours;
    
    if (member.remaining_hours >= scheduledHours + overtimeHours) {
      packageDeduction = actualHours;
      verificationData.overtimeHandling = '从套餐扣除';
    } else {
      const remainingAfterScheduled = member.remaining_hours - scheduledHours;
      if (remainingAfterScheduled > 0) {
        packageDeduction = scheduledHours + remainingAfterScheduled;
        cashPayment = (overtimeHours - remainingAfterScheduled) * 60;
      } else {
        cashPayment = overtimeHours * 60;
      }
      status = 'partial_cash';
      verificationData.overtimeHandling = '部分现金支付';
      verificationData.cashCalculation = {
        overtimeHours,
        cashRate: 60,
        cashPayment
      };
    }
  }

  if (member.remaining_hours < packageDeduction) {
    status = 'failed';
    errorMessage = `套餐余额不足。需要扣除 ${packageDeduction} 小时，剩余 ${member.remaining_hours} 小时`;
    needsManualReview = true;
  }

  verificationData.packageDeduction = packageDeduction;
  verificationData.cashPayment = cashPayment;
  verificationData.finalStatus = status;

  const settlement = {
    member_id: reservation.member_id,
    reservation_id: reservationId,
    scheduled_hours: scheduledHours,
    actual_hours: actualHours,
    package_deduction: packageDeduction,
    cash_payment: cashPayment,
    status,
    error_message: errorMessage,
    verification_data: JSON.stringify(verificationData)
  };

  return {
    success: status === 'success' || status === 'partial_cash',
    ...settlement,
    needsManualReview
  };
}

function executeSettlement(reservationId) {
  const db = getDb();
  const result = processSettlement(reservationId);

  const stmt = db.prepare(`
    INSERT INTO settlements 
    (member_id, reservation_id, scheduled_hours, actual_hours, package_deduction, cash_payment, status, error_message, verification_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    result.member_id,
    result.reservation_id,
    result.scheduled_hours,
    result.actual_hours,
    result.package_deduction,
    result.cash_payment,
    result.status,
    result.error_message,
    result.verification_data
  );

  const settlementId = info.lastInsertRowid;

  if (result.success) {
    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(result.member_id);
    db.prepare(`
      UPDATE members 
      SET remaining_hours = remaining_hours - ?, 
          used_hours = used_hours + ? 
      WHERE id = ?
    `).run(result.package_deduction, result.package_deduction, result.member_id);

    db.prepare('UPDATE reservations SET status = ? WHERE id = ?').run('completed', result.reservation_id);

    db.prepare(`
      INSERT INTO settlement_history (settlement_id, action, details)
      VALUES (?, ?, ?)
    `).run(settlementId, '自动结算', JSON.stringify({
      before: { remaining_hours: member.remaining_hours, used_hours: member.used_hours },
      after: { 
        remaining_hours: member.remaining_hours - result.package_deduction, 
        used_hours: member.used_hours + result.package_deduction 
      }
    }));
  } else {
    db.prepare(`
      INSERT INTO settlement_history (settlement_id, action, details)
      VALUES (?, ?, ?)
    `).run(settlementId, '结算失败', result.error_message);
  }

  return {
    settlementId,
    ...result
  };
}

function retrySettlement(settlementId, corrections = {}) {
  const db = getDb();
  const settlement = db.prepare('SELECT * FROM settlements WHERE id = ?').get(settlementId);
  
  if (!settlement) {
    return { success: false, message: '结算记录不存在' };
  }

  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(settlement.reservation_id);
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(settlement.member_id);

  let verificationData = JSON.parse(settlement.verification_data || '{}');
  verificationData.corrections = corrections;
  verificationData.retryAttempt = (verificationData.retryAttempt || 0) + 1;

  if (corrections.addAccessLogs) {
    const stmt = db.prepare(`
      INSERT INTO access_logs (member_id, room_id, event_type, event_time, reservation_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const log of corrections.addAccessLogs) {
      stmt.run(member.id, reservation.room_id, log.event_type, log.event_time, reservation.id);
    }
  }

  if (corrections.adjustHours) {
    verificationData.hourAdjustment = corrections.adjustHours;
  }

  const result = processSettlement(settlement.reservation_id);
  result.verification_data = JSON.stringify(verificationData);

  db.prepare(`
    UPDATE settlements SET
      scheduled_hours = ?,
      actual_hours = ?,
      package_deduction = ?,
      cash_payment = ?,
      status = ?,
      error_message = ?,
      verification_data = ?
    WHERE id = ?
  `).run(
    result.scheduled_hours,
    result.actual_hours,
    result.package_deduction,
    result.cash_payment,
    result.status,
    result.error_message,
    result.verification_data,
    settlementId
  );

  if (result.success) {
    db.prepare(`
      UPDATE members 
      SET remaining_hours = remaining_hours - ?, 
          used_hours = used_hours + ? 
      WHERE id = ?
    `).run(result.package_deduction, result.package_deduction, member.id);

    db.prepare('UPDATE reservations SET status = ? WHERE id = ?').run('completed', settlement.reservation_id);
  }

  db.prepare(`
    INSERT INTO settlement_history (settlement_id, action, details)
    VALUES (?, ?, ?)
  `).run(settlementId, '重新结算', JSON.stringify({
    corrections,
    newStatus: result.status,
    success: result.success
  }));

  return {
    success: result.success,
    settlementId,
    ...result
  };
}

module.exports = {
  calculateHours,
  validateReservation,
  validateAccessLog,
  processSettlement,
  executeSettlement,
  retrySettlement
};
