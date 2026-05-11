const { v4: uuidv4 } = require('uuid');
const { db } = require('./database');

function validateExchangeRequest(originalScheduleId, targetHallId) {
  const schedule = db.prepare(`
    SELECT s.*, h.name as hall_name, m.name as movie_name
    FROM schedules s
    JOIN halls h ON s.hall_id = h.id
    JOIN movies m ON s.movie_id = m.id
    WHERE s.id = ?
  `).get(originalScheduleId);

  if (!schedule) {
    return { valid: false, error: '原始排片不存在' };
  }

  const now = new Date();
  const startTime = new Date(schedule.start_time);

  if (startTime <= now) {
    return { valid: false, error: '该场次已开场，无法换厅' };
  }

  const existingRequest = db.prepare(`
    SELECT * FROM hall_exchange_requests
    WHERE original_schedule_id = ? AND status IN ('pending', 'processing', 'completed')
  `).get(originalScheduleId);

  if (existingRequest) {
    return { valid: false, error: `该场次已有换厅申请（状态：${existingRequest.status}），禁止重复换厅` };
  }

  const targetHall = db.prepare(`
    SELECT * FROM halls WHERE id = ?
  `).get(targetHallId);

  if (!targetHall) {
    return { valid: false, error: '目标影厅不存在' };
  }

  const conflict = db.prepare(`
    SELECT * FROM schedules
    WHERE hall_id = ? AND status = 'active'
    AND ((start_time < ? AND end_time > ?) OR (start_time >= ? AND start_time < ?))
  `).get(targetHallId, schedule.end_time, schedule.start_time, schedule.start_time, schedule.end_time);

  if (conflict) {
    return { valid: false, error: '目标影厅在该时间段已被占用' };
  }

  const tickets = db.prepare(`
    SELECT t.*, s.row_no, s.col_no, s.seat_code, s.is_vip
    FROM tickets t
    JOIN seats s ON t.seat_id = s.id
    WHERE t.schedule_id = ? AND t.status = 'sold'
  `).all(originalScheduleId);

  return {
    valid: true,
    schedule,
    targetHall,
    tickets
  };
}

function calculateSeatPrice(schedule, seat) {
  let price = parseFloat(schedule.base_price);
  if (seat.is_vip && schedule.vip_surcharge) {
    price += parseFloat(schedule.vip_surcharge);
  }
  return price;
}

function findBestMatchingSeat(originalSeat, targetHall, occupiedNewSeats) {
  const allTargetSeats = db.prepare(`
    SELECT * FROM seats
    WHERE hall_id = ? AND is_disabled = 0
    ORDER BY row_no, col_no
  `).all(targetHall.id);

  const occupiedSet = new Set(occupiedNewSeats.map(s => s.id));
  const availableSeats = allTargetSeats.filter(s => !occupiedSet.has(s.id));

  if (availableSeats.length === 0) return null;

  let exactMatch = availableSeats.find(
    s => s.row_no === originalSeat.row_no && s.col_no === originalSeat.col_no
  );
  if (exactMatch) {
    return { seat: exactMatch, mappingType: 'exact' };
  }

  const sameRow = availableSeats.find(s => s.row_no === originalSeat.row_no);
  if (sameRow) {
    return { seat: sameRow, mappingType: 'same_row' };
  }

  const nearbyRow = availableSeats.find(
    s => Math.abs(s.row_no - originalSeat.row_no) <= 2
  );
  if (nearbyRow) {
    return { seat: nearbyRow, mappingType: 'nearby' };
  }

  return { seat: availableSeats[0], mappingType: 'other' };
}

function createExchangeRequest(originalScheduleId, targetHallId, reason) {
  const validation = validateExchangeRequest(originalScheduleId, targetHallId);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const { schedule, targetHall, tickets } = validation;

  if (tickets.length === 0) {
    return { success: false, error: '该场次暂无售票，无需换厅' };
  }

  const tx = db.transaction(() => {
    const newScheduleId = uuidv4();
    db.prepare(`
      INSERT INTO schedules (id, movie_id, hall_id, start_time, end_time, base_price, vip_surcharge, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      newScheduleId,
      schedule.movie_id,
      targetHallId,
      schedule.start_time,
      schedule.end_time,
      schedule.base_price,
      schedule.vip_surcharge || 0
    );

    const requestId = uuidv4();
    db.prepare(`
      INSERT INTO hall_exchange_requests (id, original_schedule_id, target_hall_id, new_schedule_id, reason, status, affected_count)
      VALUES (?, ?, ?, ?, ?, 'processing', ?)
    `).run(requestId, originalScheduleId, targetHallId, newScheduleId, reason, tickets.length);

    const occupiedNewSeats = [];
    const mappings = [];

    for (const ticket of tickets) {
      const originalSeat = db.prepare(`
        SELECT * FROM seats WHERE id = ?
      `).get(ticket.seat_id);

      const match = findBestMatchingSeat(originalSeat, targetHall, occupiedNewSeats);
      
      let newSeatId = null;
      let mappingType = 'manual_required';
      let priceDiff = 0;
      let status = 'manual_required';

      if (match) {
        newSeatId = match.seat.id;
        mappingType = match.mappingType;
        occupiedNewSeats.push(match.seat);
        
        const newSchedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(newScheduleId);
        const originalPrice = calculateSeatPrice(schedule, originalSeat);
        const newPrice = calculateSeatPrice(newSchedule, match.seat);
        priceDiff = newPrice - originalPrice;
        status = 'pending_confirm';
      }

      const mappingId = uuidv4();
      db.prepare(`
        INSERT INTO hall_exchange_seat_mappings (id, request_id, ticket_id, original_seat_id, new_seat_id, mapping_type, price_diff, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(mappingId, requestId, ticket.id, ticket.seat_id, newSeatId, mappingType, priceDiff, status);

      mappings.push({
        id: mappingId,
        ticket,
        originalSeat,
        newSeat: match?.seat,
        mappingType,
        priceDiff,
        status
      });
    }

    return {
      success: true,
      requestId,
      newScheduleId,
      affectedCount: tickets.length,
      mappings
    };
  });

  return tx();
}

function resolveManualSeat(mappingId, newSeatId) {
  const mapping = db.prepare(`
    SELECT m.*, r.original_schedule_id, r.new_schedule_id
    FROM hall_exchange_seat_mappings m
    JOIN hall_exchange_requests r ON m.request_id = r.id
    WHERE m.id = ?
  `).get(mappingId);

  if (!mapping) {
    return { success: false, error: '映射记录不存在' };
  }

  if (mapping.status === 'resolved' || mapping.status === 'refunded') {
    return { success: false, error: '该座位已处理完成' };
  }

  const newSeat = db.prepare(`
    SELECT * FROM seats WHERE id = ? AND hall_id = (
      SELECT hall_id FROM schedules WHERE id = ?
    )
  `).get(newSeatId, mapping.new_schedule_id);

  if (!newSeat) {
    return { success: false, error: '无效的目标座位' };
  }

  const conflict = db.prepare(`
    SELECT * FROM hall_exchange_seat_mappings
    WHERE new_seat_id = ? AND id != ? AND status != 'refunded'
  `).get(newSeatId, mappingId);

  if (conflict) {
    return { success: false, error: '该座位已被分配给其他观众' };
  }

  const originalSeat = db.prepare('SELECT * FROM seats WHERE id = ?').get(mapping.original_seat_id);
  const originalSchedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(mapping.original_schedule_id);
  const newSchedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(mapping.new_schedule_id);

  const originalPrice = calculateSeatPrice(originalSchedule, originalSeat);
  const newPrice = calculateSeatPrice(newSchedule, newSeat);
  const priceDiff = newPrice - originalPrice;

  db.prepare(`
    UPDATE hall_exchange_seat_mappings
    SET new_seat_id = ?, mapping_type = 'manual', price_diff = ?, status = 'pending_confirm'
    WHERE id = ?
  `).run(newSeatId, priceDiff, mappingId);

  return {
    success: true,
    priceDiff,
    newSeat
  };
}

function processRefund(mappingId, reason) {
  const mapping = db.prepare(`
    SELECT m.*, t.paid_price
    FROM hall_exchange_seat_mappings m
    JOIN tickets t ON m.ticket_id = t.id
    WHERE m.id = ?
  `).get(mappingId);

  if (!mapping) {
    return { success: false, error: '映射记录不存在' };
  }

  if (mapping.status === 'resolved' || mapping.status === 'refunded') {
    return { success: false, error: '该座位已处理完成' };
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE hall_exchange_seat_mappings
      SET status = 'refunded', resolution = 'refund', refund_amount = ?
      WHERE id = ?
    `).run(mapping.paid_price, mappingId);

    const refundId = uuidv4();
    db.prepare(`
      INSERT INTO refunds (id, ticket_id, request_id, amount, reason)
      VALUES (?, ?, ?, ?, ?)
    `).run(refundId, mapping.ticket_id, mapping.request_id, mapping.paid_price, reason || '换厅座位无法安排，全额退款');

    db.prepare(`
      UPDATE tickets SET status = 'refunded' WHERE id = ?
    `).run(mapping.ticket_id);
  });

  tx();

  return {
    success: true,
    refundAmount: mapping.paid_price
  };
}

function confirmExchangeMapping(mappingId) {
  const mapping = db.prepare(`
    SELECT m.*, r.new_schedule_id, t.id as ticket_id, t.paid_price
    FROM hall_exchange_seat_mappings m
    JOIN hall_exchange_requests r ON m.request_id = r.id
    JOIN tickets t ON m.ticket_id = t.id
    WHERE m.id = ?
  `).get(mappingId);

  if (!mapping) {
    return { success: false, error: '映射记录不存在' };
  }

  if (mapping.status === 'resolved' || mapping.status === 'refunded') {
    return { success: false, error: '该座位已处理完成' };
  }

  if (mapping.status === 'manual_required') {
    return { success: false, error: '该座位需要先安排或选择退款' };
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE hall_exchange_seat_mappings
      SET status = 'resolved', resolution = 'exchanged'
      WHERE id = ?
    `).run(mappingId);

    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(mapping.ticket_id);
    
    db.prepare(`
      UPDATE tickets
      SET schedule_id = ?, seat_id = ?, original_schedule_id = ?, original_seat_id = ?,
          price = price + ?, status = 'exchanged'
      WHERE id = ?
    `).run(mapping.new_schedule_id, mapping.new_seat_id, ticket.schedule_id, ticket.seat_id, mapping.price_diff, ticket.id);

    if (mapping.price_diff < 0) {
      const refundId = uuidv4();
      db.prepare(`
        INSERT INTO refunds (id, ticket_id, request_id, amount, reason, status)
        VALUES (?, ?, ?, ?, '换厅差价退款', 'pending')
      `).run(refundId, mapping.ticket_id, mapping.request_id, Math.abs(mapping.price_diff));
    }
  });

  tx();

  return {
    success: true,
    priceDiff: mapping.price_diff
  };
}

function canCompleteRequest(requestId) {
  const pending = db.prepare(`
    SELECT COUNT(*) as count
    FROM hall_exchange_seat_mappings
    WHERE request_id = ? AND status IN ('pending_confirm', 'manual_required')
  `).get(requestId);

  return pending.count === 0;
}

function completeExchangeRequest(requestId) {
  if (!canCompleteRequest(requestId)) {
    return { success: false, error: '存在未处理的座位映射（待确认或需人工处理），无法完成换厅' };
  }

  const request = db.prepare(`
    SELECT * FROM hall_exchange_requests WHERE id = ?
  `).get(requestId);

  if (!request) {
    return { success: false, error: '换厅申请不存在' };
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE schedules SET status = 'replaced' WHERE id = ?
    `).run(request.original_schedule_id);

    db.prepare(`
      UPDATE hall_exchange_requests
      SET status = 'completed', processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(requestId);

    const mappings = db.prepare(`
      SELECT m.*, t.customer_name, t.customer_phone, s1.seat_code as original_code, s2.seat_code as new_code
      FROM hall_exchange_seat_mappings m
      JOIN tickets t ON m.ticket_id = t.id
      JOIN seats s1 ON m.original_seat_id = s1.id
      LEFT JOIN seats s2 ON m.new_seat_id = s2.id
      WHERE m.request_id = ?
    `).all(requestId);

    for (const mapping of mappings) {
      const notificationId = uuidv4();
      let title, content;

      if (mapping.status === 'resolved') {
        title = '座位更换通知';
        content = `您好${mapping.customer_name ? ' ' + mapping.customer_name : ''}，您的座位已从${mapping.original_code}调整为${mapping.new_code}。`;
        if (mapping.price_diff !== 0) {
          content += mapping.price_diff > 0 
            ? ` 需补差价¥${mapping.price_diff.toFixed(2)}。` 
            : ` 将退还差价¥${Math.abs(mapping.price_diff).toFixed(2)}。`;
        }
      } else {
        title = '退票通知';
        content = `您好${mapping.customer_name ? ' ' + mapping.customer_name : ''}，由于设备故障，您的座位${mapping.original_code}无法安排，已为您办理全额退款¥${mapping.refund_amount?.toFixed(2) || 0}。`;
      }

      db.prepare(`
        INSERT INTO notifications (id, type, target, title, content, status)
        VALUES (?, 'sms', ?, ?, ?, 'sent')
      `).run(notificationId, mapping.customer_phone || 'unknown', title, content);
    }
  });

  tx();

  return { success: true };
}

function getExchangeDetails(requestId) {
  const request = db.prepare(`
    SELECT r.*, m.name as movie_name, oh.name as original_hall, th.name as target_hall,
           os.start_time, os.end_time
    FROM hall_exchange_requests r
    JOIN schedules os ON r.original_schedule_id = os.id
    JOIN schedules ns ON r.new_schedule_id = ns.id
    JOIN halls oh ON os.hall_id = oh.id
    JOIN halls th ON ns.hall_id = th.id
    JOIN movies m ON os.movie_id = m.id
    WHERE r.id = ?
  `).get(requestId);

  if (!request) return null;

  const mappings = db.prepare(`
    SELECT m.*, t.customer_name, t.customer_phone, t.order_no, t.paid_price,
           s1.row_no as original_row, s1.col_no as original_col, s1.seat_code as original_code, s1.is_vip as original_vip,
           s2.row_no as new_row, s2.col_no as new_col, s2.seat_code as new_code, s2.is_vip as new_vip
    FROM hall_exchange_seat_mappings m
    JOIN tickets t ON m.ticket_id = t.id
    JOIN seats s1 ON m.original_seat_id = s1.id
    LEFT JOIN seats s2 ON m.new_seat_id = s2.id
    WHERE m.request_id = ?
    ORDER BY m.status, s1.row_no, s1.col_no
  `).all(requestId);

  const stats = {
    total: mappings.length,
    pendingConfirm: mappings.filter(m => m.status === 'pending_confirm').length,
    manualRequired: mappings.filter(m => m.status === 'manual_required').length,
    resolved: mappings.filter(m => m.status === 'resolved').length,
    refunded: mappings.filter(m => m.status === 'refunded').length,
    totalDiff: mappings.reduce((sum, m) => sum + (m.price_diff || 0), 0),
    totalRefund: mappings.filter(m => m.status === 'refunded').reduce((sum, m) => sum + (m.refund_amount || 0), 0)
  };

  return {
    request,
    mappings,
    stats,
    canComplete: canCompleteRequest(requestId)
  };
}

module.exports = {
  validateExchangeRequest,
  createExchangeRequest,
  resolveManualSeat,
  processRefund,
  confirmExchangeMapping,
  completeExchangeRequest,
  getExchangeDetails,
  canCompleteRequest
};
