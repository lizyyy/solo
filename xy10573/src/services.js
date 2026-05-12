const { db } = require('./db');
const dayjs = require('dayjs');
const { v4: uuidv4 } = require('uuid');
const rules = require('./rules');

function generateBookingNo() {
  const today = dayjs().format('YYYYMMDD');
  const count = db.prepare(`
    SELECT COUNT(*) as cnt FROM boarding_bookings
    WHERE strftime('%Y%m%d', created_at) = ?
  `).get(today).cnt;
  return `BK${today}${String(count + 1).padStart(4, '0')}`;
}

function createBooking(data, operator = 'system') {
  const {
    pet_id,
    room_id,
    check_in_date,
    check_out_date,
    owner_name,
    owner_phone
  } = data;

  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(pet_id);
  if (!pet) {
    return { success: false, error: '宠物不存在', code: 'PET_NOT_FOUND' };
  }

  const vaccineCheck = rules.checkVaccineValidity(pet_id, check_in_date);
  if (!vaccineCheck.valid) {
    return { success: false, error: vaccineCheck.reason, details: vaccineCheck };
  }

  const duplicateCheck = rules.checkDuplicateBooking(pet_id, check_in_date, check_out_date);
  if (duplicateCheck.conflict) {
    return {
      success: false,
      error: '与现有预约时间重叠',
      code: 'DUPLICATE_BOOKING',
      conflicts: duplicateCheck.overlaps
    };
  }

  const roomCheck = rules.checkRoomAvailability(room_id, check_in_date, check_out_date);
  if (!roomCheck.available) {
    return { success: false, error: roomCheck.reason, details: roomCheck };
  }

  const roomCharge = rules.calculateRoomCharge(room_id, check_in_date, check_out_date);
  
  const bookingId = uuidv4();
  const bookingNo = generateBookingNo();
  const effectiveOwnerName = owner_name || pet.owner_name;
  const effectiveOwnerPhone = owner_phone || pet.owner_phone;

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO boarding_bookings (
        id, booking_no, pet_id, room_id, owner_name, owner_phone,
        check_in_date, check_out_date, status, total_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      bookingId, bookingNo, pet_id, room_id,
      effectiveOwnerName, effectiveOwnerPhone,
      check_in_date, check_out_date, 'pending', roomCharge
    );

    rules.recordHistory(bookingId, 'CREATE', null, {
      booking_no: bookingNo,
      pet_id, room_id, check_in_date, check_out_date, roomCharge
    }, operator, '创建预约');
  });

  tx();

  const booking = db.prepare('SELECT * FROM boarding_bookings WHERE id = ?').get(bookingId);
  return { success: true, data: booking };
}

function confirmBooking(bookingId, operator = 'system') {
  const booking = db.prepare('SELECT * FROM boarding_bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    return { success: false, error: '预约不存在', code: 'BOOKING_NOT_FOUND' };
  }

  if (booking.status !== 'pending') {
    return { success: false, error: `当前状态[${booking.status}]无法确认`, code: 'INVALID_STATUS' };
  }

  const beforeData = { status: booking.status };
  
  db.prepare(`
    UPDATE boarding_bookings SET status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run('confirmed', bookingId);

  rules.recordHistory(bookingId, 'CONFIRM', beforeData, { status: 'confirmed' }, operator, '确认预约');

  const updated = db.prepare('SELECT * FROM boarding_bookings WHERE id = ?').get(bookingId);
  return { success: true, data: updated };
}

function checkInBooking(bookingId, data = {}, operator = 'system') {
  const booking = db.prepare('SELECT * FROM boarding_bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    return { success: false, error: '预约不存在', code: 'BOOKING_NOT_FOUND' };
  }

  if (booking.status !== 'confirmed' && booking.status !== 'pending') {
    return { success: false, error: `当前状态[${booking.status}]无法入住`, code: 'INVALID_STATUS' };
  }

  const actualCheckIn = data.actual_check_in || dayjs().format('YYYY-MM-DD');
  const beforeData = { status: booking.status };

  db.prepare(`
    UPDATE boarding_bookings SET 
      status = ?, 
      actual_check_in = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run('checked_in', actualCheckIn, bookingId);

  rules.recordHistory(bookingId, 'CHECK_IN', beforeData, { 
    status: 'checked_in', 
    actual_check_in: actualCheckIn 
  }, operator, `办理入住，实际入住时间: ${actualCheckIn}`);

  const updated = db.prepare('SELECT * FROM boarding_bookings WHERE id = ?').get(bookingId);
  return { success: true, data: updated };
}

function checkOutBooking(bookingId, data = {}, operator = 'system') {
  const booking = db.prepare('SELECT * FROM boarding_bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    return { success: false, error: '预约不存在', code: 'BOOKING_NOT_FOUND' };
  }

  if (booking.status !== 'checked_in') {
    return { success: false, error: `当前状态[${booking.status}]无法退房`, code: 'INVALID_STATUS' };
  }

  const actualCheckOut = data.actual_check_out || dayjs().format('YYYY-MM-DD');
  const refundInfo = rules.calculateEarlyCheckoutRefund(booking, actualCheckOut);
  const roomCharge = rules.calculateRoomCharge(booking.room_id, booking.check_in_date, actualCheckOut);
  const addOnCharge = rules.calculateAddOnCharge(bookingId);
  const transportFee = rules.calculateTransportFee(bookingId);
  
  const totalAmount = roomCharge + addOnCharge + transportFee;
  const refundAmount = refundInfo.refundable;

  const settlementId = uuidv4();

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE boarding_bookings SET 
        status = ?, 
        actual_check_out = ?,
        total_amount = ?,
        refund_amount = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run('completed', actualCheckOut, totalAmount, refundAmount, bookingId);

    db.prepare(`
      INSERT INTO settlements (
        id, booking_id, room_charge, add_on_charge, transport_fee,
        total_amount, paid_amount, refund_amount, settlement_type, operator
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      settlementId, bookingId, roomCharge, addOnCharge, transportFee,
      totalAmount, booking.paid_amount, refundAmount, 'checkout', operator
    );

    rules.recordHistory(bookingId, 'CHECK_OUT', 
      { status: booking.status, actual_check_out: null }, 
      { status: 'completed', actual_check_out: actualCheckOut, refundAmount, roomCharge }, 
      operator, 
      `办理退房，实际退房时间: ${actualCheckOut}, 退款: ¥${refundAmount}`
    );
  });

  tx();

  const updated = db.prepare('SELECT * FROM boarding_bookings WHERE id = ?').get(bookingId);
  const settlement = db.prepare('SELECT * FROM settlements WHERE id = ?').get(settlementId);

  return {
    success: true,
    data: {
      booking: updated,
      settlement,
      refundInfo
    }
  };
}

function cancelBooking(bookingId, data = {}, operator = 'system') {
  const booking = db.prepare('SELECT * FROM boarding_bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    return { success: false, error: '预约不存在', code: 'BOOKING_NOT_FOUND' };
  }

  if (booking.status === 'completed' || booking.status === 'cancelled') {
    return { success: false, error: `当前状态[${booking.status}]无法取消`, code: 'INVALID_STATUS' };
  }

  const beforeData = { status: booking.status, cancellation_reason: null };

  db.prepare(`
    UPDATE boarding_bookings SET 
      status = ?, 
      cancellation_reason = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run('cancelled', data.reason || '客户取消', bookingId);

  rules.recordHistory(bookingId, 'CANCEL', beforeData, { 
    status: 'cancelled', 
    cancellation_reason: data.reason || '客户取消'
  }, operator, `取消预约: ${data.reason || '客户取消'}`);

  const updated = db.prepare('SELECT * FROM boarding_bookings WHERE id = ?').get(bookingId);
  return { success: true, data: updated };
}

function addAddOn(bookingId, data, operator = 'system') {
  const booking = db.prepare('SELECT * FROM boarding_bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    return { success: false, error: '预约不存在', code: 'BOOKING_NOT_FOUND' };
  }

  if (booking.status === 'completed' || booking.status === 'cancelled') {
    return { success: false, error: `当前状态[${booking.status}]无法添加加购`, code: 'INVALID_STATUS' };
  }

  const addOn = db.prepare('SELECT * FROM add_ons WHERE id = ?').get(data.add_on_id);
  if (!addOn) {
    return { success: false, error: '加购服务不存在', code: 'ADDON_NOT_FOUND' };
  }

  const quantity = data.quantity || 1;
  const unitPrice = addOn.price;
  const totalPrice = Math.round(unitPrice * quantity * 100) / 100;
  const addOnRecordId = uuidv4();

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO booking_add_ons (
        id, booking_id, add_on_id, quantity, unit_price, total_price,
        applied_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      addOnRecordId, bookingId, data.add_on_id, quantity, unitPrice, totalPrice,
      data.applied_date || dayjs().format('YYYY-MM-DD'), data.notes || ''
    );

    const newTotal = booking.total_amount + totalPrice;
    db.prepare(`
      UPDATE boarding_bookings SET total_amount = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newTotal, bookingId);

    rules.recordHistory(bookingId, 'ADD_ADDON', 
      { total_amount: booking.total_amount }, 
      { total_amount: newTotal, add_on: addOn.name, quantity, totalPrice }, 
      operator, 
      `添加加购: ${addOn.name} x${quantity} = ¥${totalPrice}`
    );
  });

  tx();

  const addOnRecord = db.prepare('SELECT * FROM booking_add_ons WHERE id = ?').get(addOnRecordId);
  const updatedBooking = db.prepare('SELECT * FROM boarding_bookings WHERE id = ?').get(bookingId);

  return {
    success: true,
    data: {
      addOnRecord,
      addOnInfo: addOn,
      booking: updatedBooking
    }
  };
}

function createFeedingPlan(bookingId, data, operator = 'system') {
  const booking = db.prepare('SELECT * FROM boarding_bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    return { success: false, error: '预约不存在', code: 'BOOKING_NOT_FOUND' };
  }

  const compatCheck = rules.checkFeedingCompatibility(bookingId, data);
  if (!compatCheck.compatible) {
    return { success: false, error: compatCheck.reason, details: compatCheck };
  }

  const planId = uuidv4();
  db.prepare(`
    INSERT INTO feeding_plans (
      id, booking_id, pet_id, meal_time, food_type, portion, notes, special_instructions
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    planId, bookingId, booking.pet_id,
    data.meal_time, data.food_type, data.portion,
    data.notes, data.special_instructions
  );

  rules.recordHistory(bookingId, 'CREATE_FEEDING_PLAN', null, {
    meal_time: data.meal_time,
    food_type: data.food_type
  }, operator, `创建喂养计划: ${data.meal_time} - ${data.food_type}`);

  const plan = db.prepare('SELECT * FROM feeding_plans WHERE id = ?').get(planId);
  return { success: true, data: { plan, warnings: compatCheck.warnings } };
}

function recordFeeding(bookingId, data, operator = 'system') {
  const booking = db.prepare('SELECT * FROM boarding_bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    return { success: false, error: '预约不存在', code: 'BOOKING_NOT_FOUND' };
  }

  const recordId = uuidv4();
  db.prepare(`
    INSERT INTO feeding_records (
      id, booking_id, pet_id, feeding_date, meal_time, food_type, portion, notes, staff_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    recordId, bookingId, booking.pet_id,
    data.feeding_date || dayjs().format('YYYY-MM-DD'),
    data.meal_time, data.food_type, data.portion, data.notes, operator
  );

  rules.recordHistory(bookingId, 'RECORD_FEEDING', null, {
    feeding_date: data.feeding_date,
    meal_time: data.meal_time
  }, operator, `记录喂养: ${data.meal_time}`);

  const record = db.prepare('SELECT * FROM feeding_records WHERE id = ?').get(recordId);
  return { success: true, data: record };
}

function addCareLog(bookingId, data, operator = 'system') {
  const booking = db.prepare('SELECT * FROM boarding_bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    return { success: false, error: '预约不存在', code: 'BOOKING_NOT_FOUND' };
  }

  const logId = uuidv4();
  db.prepare(`
    INSERT INTO care_logs (
      id, booking_id, pet_id, log_date, log_type, content, staff_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    logId, bookingId, booking.pet_id,
    data.log_date || dayjs().format('YYYY-MM-DD'),
    data.log_type, data.content, operator
  );

  rules.recordHistory(bookingId, 'ADD_CARE_LOG', null, {
    log_type: data.log_type,
    log_date: data.log_date
  }, operator, `添加照护记录: ${data.log_type}`);

  const log = db.prepare('SELECT * FROM care_logs WHERE id = ?').get(logId);
  return { success: true, data: log };
}

function createTransport(bookingId, data, operator = 'system') {
  const booking = db.prepare('SELECT * FROM boarding_bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    return { success: false, error: '预约不存在', code: 'BOOKING_NOT_FOUND' };
  }

  const transportId = uuidv4();
  db.prepare(`
    INSERT INTO transport_records (
      id, booking_id, type, pickup_address, pickup_time,
      dropoff_address, dropoff_time, driver_name, vehicle_no, fee
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    transportId, bookingId, data.type,
    data.pickup_address, data.pickup_time,
    data.dropoff_address, data.dropoff_time,
    data.driver_name, data.vehicle_no, data.fee || 0
  );

  if (data.fee > 0) {
    const newTotal = booking.total_amount + data.fee;
    db.prepare(`
      UPDATE boarding_bookings SET total_amount = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newTotal, bookingId);
  }

  rules.recordHistory(bookingId, 'CREATE_TRANSPORT', null, {
    type: data.type, fee: data.fee || 0
  }, operator, `创建接送服务: ${data.type}`);

  const transport = db.prepare('SELECT * FROM transport_records WHERE id = ?').get(transportId);
  return { success: true, data: transport };
}

function updatePayment(bookingId, data, operator = 'system') {
  const booking = db.prepare('SELECT * FROM boarding_bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    return { success: false, error: '预约不存在', code: 'BOOKING_NOT_FOUND' };
  }

  const beforeData = { paid_amount: booking.paid_amount };
  const newPaid = booking.paid_amount + (data.amount || 0);

  db.prepare(`
    UPDATE boarding_bookings SET paid_amount = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(newPaid, bookingId);

  rules.recordHistory(bookingId, 'UPDATE_PAYMENT', beforeData, {
    paid_amount: newPaid,
    added_amount: data.amount || 0
  }, operator, `更新付款: +¥${data.amount || 0}`);

  const updated = db.prepare('SELECT * FROM boarding_bookings WHERE id = ?').get(bookingId);
  return { success: true, data: updated };
}

function manualCorrection(bookingId, data, operator = 'system') {
  const booking = db.prepare('SELECT * FROM boarding_bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    return { success: false, error: '预约不存在', code: 'BOOKING_NOT_FOUND' };
  }

  const updates = [];
  const params = [];
  const beforeData = {};
  const afterData = {};

  const allowedFields = ['room_id', 'check_in_date', 'check_out_date', 'status', 'owner_name', 'owner_phone'];
  
  for (const field of allowedFields) {
    if (data[field] !== undefined && data[field] !== booking[field]) {
      updates.push(`${field} = ?`);
      params.push(data[field]);
      beforeData[field] = booking[field];
      afterData[field] = data[field];
    }
  }

  if (updates.length === 0) {
    return { success: true, message: '无修改内容', data: booking };
  }

  params.push(bookingId);

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE boarding_bookings SET ${updates.join(', ')}, updated_at = datetime('now')
      WHERE id = ?
    `).run(...params);

    if (data.room_id !== undefined && data.room_id !== booking.room_id) {
      const roomCharge = rules.calculateRoomCharge(
        afterData.room_id || booking.room_id,
        afterData.check_in_date || booking.check_in_date,
        afterData.check_out_date || booking.check_out_date
      );
      beforeData.total_amount = booking.total_amount;
      afterData.total_amount = roomCharge + rules.calculateAddOnCharge(bookingId) + rules.calculateTransportFee(bookingId);
      
      db.prepare(`
        UPDATE boarding_bookings SET total_amount = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(afterData.total_amount, bookingId);
    }

    rules.recordHistory(bookingId, 'MANUAL_CORRECTION', beforeData, afterData, operator, data.reason || '人工修正');
  });

  tx();

  const updated = db.prepare('SELECT * FROM boarding_bookings WHERE id = ?').get(bookingId);
  return { 
    success: true, 
    data: updated, 
    diff: { before: beforeData, after: afterData }
  };
}

function getBookingDetail(bookingId) {
  const booking = db.prepare('SELECT * FROM boarding_bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    return { success: false, error: '预约不存在', code: 'BOOKING_NOT_FOUND' };
  }

  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(booking.pet_id);
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(booking.room_id);
  const vaccines = db.prepare('SELECT * FROM vaccine_records WHERE pet_id = ?').all(booking.pet_id);
  const addOns = db.prepare(`
    SELECT ba.*, ao.name, ao.category, ao.unit
    FROM booking_add_ons ba
    LEFT JOIN add_ons ao ON ba.add_on_id = ao.id
    WHERE ba.booking_id = ?
  `).all(bookingId);
  const feedingPlans = db.prepare('SELECT * FROM feeding_plans WHERE booking_id = ?').all(bookingId);
  const feedingRecords = db.prepare('SELECT * FROM feeding_records WHERE booking_id = ? ORDER BY feeding_date DESC, meal_time DESC').all(bookingId);
  const careLogs = db.prepare('SELECT * FROM care_logs WHERE booking_id = ? ORDER BY log_date DESC, created_at DESC').all(bookingId);
  const transports = db.prepare('SELECT * FROM transport_records WHERE booking_id = ?').all(bookingId);
  const histories = db.prepare('SELECT * FROM booking_histories WHERE booking_id = ? ORDER BY created_at DESC').all(bookingId);
  const settlements = db.prepare('SELECT * FROM settlements WHERE booking_id = ?').all(bookingId);

  const vaccineInfo = vaccines.map(v => ({
    type: v.vaccine_type,
    name: v.vaccine_name,
    administered_date: v.administered_date,
    expiry_date: v.expiry_date,
    is_expired: dayjs(v.expiry_date).isBefore(dayjs())
  }));

  const addOnTotal = addOns.reduce((sum, a) => sum + a.total_price, 0);
  const transportTotal = transports.reduce((sum, t) => sum + t.fee, 0);

  return {
    success: true,
    data: {
      booking,
      pet,
      room,
      vaccineInfo,
      addOns,
      feedingPlans,
      feedingRecords,
      careLogs,
      transports,
      histories,
      settlements,
      summary: {
        room_charge: booking.total_amount - addOnTotal - transportTotal,
        add_on_charge: addOnTotal,
        transport_fee: transportTotal,
        total_amount: booking.total_amount,
        paid_amount: booking.paid_amount,
        refund_amount: booking.refund_amount,
        balance: booking.total_amount - booking.paid_amount + (booking.refund_amount || 0)
      }
    }
  };
}

function getBookingCalendar(startDate, endDate) {
  const start = startDate || dayjs().subtract(7, 'day').format('YYYY-MM-DD');
  const end = endDate || dayjs().add(30, 'day').format('YYYY-MM-DD');

  const bookings = db.prepare(`
    SELECT 
      b.id, b.booking_no, b.status,
      b.check_in_date, b.check_out_date,
      b.actual_check_in, b.actual_check_out,
      p.name as pet_name, p.species, p.breed,
      r.name as room_name, r.type as room_type
    FROM boarding_bookings b
    LEFT JOIN pets p ON b.pet_id = p.id
    LEFT JOIN rooms r ON b.room_id = r.id
    WHERE 
      (b.check_in_date <= ? AND b.check_out_date > ?)
      OR (b.check_in_date >= ? AND b.check_in_date < ?)
    ORDER BY b.check_in_date
  `).all(end, start, start, end);

  const rooms = db.prepare('SELECT * FROM rooms ORDER BY type, name').all();
  const calendar = {};

  for (const room of rooms) {
    calendar[room.id] = {
      room,
      bookings: bookings.filter(b => b.room_id === room.id)
    };
  }

  const statusMap = {
    pending: { text: '待确认', color: 'yellow' },
    confirmed: { text: '已确认', color: 'blue' },
    checked_in: { text: '入住中', color: 'green' },
    completed: { text: '已完成', color: 'gray' },
    cancelled: { text: '已取消', color: 'red' }
  };

  const formattedBookings = bookings.map(b => ({
    ...b,
    status_text: statusMap[b.status]?.text || b.status,
    status_color: statusMap[b.status]?.color || 'default',
    duration_days: dayjs(b.check_out_date).diff(dayjs(b.check_in_date), 'day')
  }));

  const stats = {
    total: formattedBookings.length,
    pending: formattedBookings.filter(b => b.status === 'pending').length,
    confirmed: formattedBookings.filter(b => b.status === 'confirmed').length,
    checked_in: formattedBookings.filter(b => b.status === 'checked_in').length,
    completed: formattedBookings.filter(b => b.status === 'completed').length,
    cancelled: formattedBookings.filter(b => b.status === 'cancelled').length
  };

  return {
    success: true,
    data: {
      date_range: { start, end },
      rooms,
      bookings: formattedBookings,
      by_room: calendar,
      stats
    }
  };
}

function getOperationReport(startDate, endDate) {
  const start = startDate || dayjs().subtract(30, 'day').format('YYYY-MM-DD');
  const end = endDate || dayjs().format('YYYY-MM-DD');

  const bookings = db.prepare(`
    SELECT 
      b.id, b.status, b.total_amount, b.paid_amount, b.refund_amount,
      b.check_in_date, b.check_out_date, b.created_at,
      r.type as room_type, r.name as room_name,
      p.species, p.breed
    FROM boarding_bookings b
    LEFT JOIN rooms r ON b.room_id = r.id
    LEFT JOIN pets p ON b.pet_id = p.id
    WHERE date(b.created_at) BETWEEN ? AND ?
    ORDER BY b.created_at DESC
  `).all(start, end);

  const settlements = db.prepare(`
    SELECT 
      s.*,
      b.booking_no
    FROM settlements s
    LEFT JOIN boarding_bookings b ON s.booking_id = b.id
    WHERE date(s.settlement_time) BETWEEN ? AND ?
  `).all(start, end);

  const addOnStats = db.prepare(`
    SELECT 
      ao.category, ao.name,
      COUNT(ba.id) as usage_count,
      SUM(ba.quantity) as total_quantity,
      SUM(ba.total_price) as total_revenue
    FROM booking_add_ons ba
    LEFT JOIN add_ons ao ON ba.add_on_id = ao.id
    WHERE date(ba.created_at) BETWEEN ? AND ?
    GROUP BY ao.category, ao.name
    ORDER BY total_revenue DESC
  `).all(start, end);

  const roomStats = db.prepare(`
    SELECT 
      r.id, r.name, r.type, r.base_rate,
      COUNT(b.id) as booking_count
    FROM rooms r
    LEFT JOIN boarding_bookings b ON r.id = b.room_id 
      AND date(b.created_at) BETWEEN ? AND ?
      AND b.status != 'cancelled'
    GROUP BY r.id
  `).all(start, end);

  const totalRevenue = bookings
    .filter(b => b.status !== 'cancelled')
    .reduce((sum, b) => sum + (b.total_amount || 0), 0);
  
  const totalRefund = bookings.reduce((sum, b) => sum + (b.refund_amount || 0), 0);
  const totalPaid = bookings.reduce((sum, b) => sum + (b.paid_amount || 0), 0);

  const speciesBreakdown = {};
  bookings.forEach(b => {
    if (b.species) {
      speciesBreakdown[b.species] = (speciesBreakdown[b.species] || 0) + 1;
    }
  });

  return {
    success: true,
    data: {
      date_range: { start, end },
      summary: {
        total_bookings: bookings.length,
        completed_bookings: bookings.filter(b => b.status === 'completed').length,
        cancelled_bookings: bookings.filter(b => b.status === 'cancelled').length,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        total_refund: Math.round(totalRefund * 100) / 100,
        net_revenue: Math.round((totalRevenue - totalRefund) * 100) / 100,
        total_paid: Math.round(totalPaid * 100) / 100,
        cancellation_rate: bookings.length > 0 
          ? Math.round(bookings.filter(b => b.status === 'cancelled').length / bookings.length * 100) / 100 
          : 0
      },
      bookings: bookings.slice(0, 50),
      settlements: settlements.slice(0, 50),
      add_on_stats: addOnStats,
      room_stats: roomStats,
      species_breakdown: speciesBreakdown
    }
  };
}

function getRooms() {
  const rooms = db.prepare('SELECT * FROM rooms ORDER BY type, name').all();
  return { success: true, data: rooms };
}

function getRoomAvailability(roomId, startDate, endDate) {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  if (!room) {
    return { success: false, error: '房型不存在', code: 'ROOM_NOT_FOUND' };
  }

  const start = startDate || dayjs().format('YYYY-MM-DD');
  const end = endDate || dayjs().add(14, 'day').format('YYYY-MM-DD');

  const bookings = db.prepare(`
    SELECT check_in_date, check_out_date, status
    FROM boarding_bookings
    WHERE room_id = ?
    AND status NOT IN ('cancelled')
    AND (
      (check_in_date <= ? AND check_out_date > ?)
      OR (check_in_date >= ? AND check_in_date < ?)
    )
  `).all(roomId, end, start, start, end);

  const availability = [];
  let d = dayjs(start);
  const endDay = dayjs(end);
  
  while (d.isBefore(endDay)) {
    const dateStr = d.format('YYYY-MM-DD');
    const bookedOnDate = bookings.filter(b => 
      dayjs(b.check_in_date).isBefore(d.add(1, 'day')) && dayjs(b.check_out_date).isAfter(d)
    ).length;
    
    availability.push({
      date: dateStr,
      total_capacity: room.capacity,
      booked: bookedOnDate,
      available: room.capacity - bookedOnDate
    });
    
    d = d.add(1, 'day');
  }

  return {
    success: true,
    data: {
      room,
      availability,
      current_bookings: bookings
    }
  };
}

function getAddOns() {
  const addOns = db.prepare('SELECT * FROM add_ons ORDER BY category, name').all();
  return { success: true, data: addOns };
}

function getPets() {
  const pets = db.prepare('SELECT * FROM pets ORDER BY name').all();
  return { success: true, data: pets };
}

function getBookingHistory(bookingId) {
  const histories = db.prepare(`
    SELECT * FROM booking_histories 
    WHERE booking_id = ? 
    ORDER BY created_at DESC
  `).all(bookingId);

  return { success: true, data: histories };
}

module.exports = {
  createBooking,
  confirmBooking,
  checkInBooking,
  checkOutBooking,
  cancelBooking,
  addAddOn,
  createFeedingPlan,
  recordFeeding,
  addCareLog,
  createTransport,
  updatePayment,
  manualCorrection,
  getBookingDetail,
  getBookingCalendar,
  getOperationReport,
  getRooms,
  getRoomAvailability,
  getAddOns,
  getPets,
  getBookingHistory
};