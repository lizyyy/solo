const db = require('../config/database');
const { NotFoundError, ValidationError, InsufficientDepositError } = require('../utils/errors');
const { validateBookingCreation, validateBookingModification } = require('../services/conflictService');
const { calculateRoomFee, calculateDeviceFee, calculateBookingTotal, calculateDepositRequired, checkDepositSufficient } = require('../services/pricingService');
const { BOOKING_STATES, updateBookingStatus, getStateDisplayName, isModifiableState } = require('../services/bookingStateService');
const { format } = require('date-fns');

function generateBookingNumber() {
  const dateStr = format(new Date(), 'yyyyMMdd');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `BK${dateStr}${random}`;
}

function getAllBookings(req, res, next) {
  try {
    const { status, roomId, customerId, date } = req.query;
    let sql = `
      SELECT b.*, 
             r.name as room_name, r.type as room_type, r.base_rate_per_hour,
             c.name as customer_name, c.phone as customer_phone
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      JOIN customers c ON b.customer_id = c.id
    `;
    const params = [];
    const conditions = [];
    
    if (status) {
      conditions.push('b.status = ?');
      params.push(status);
    }
    if (roomId) {
      conditions.push('b.room_id = ?');
      params.push(roomId);
    }
    if (customerId) {
      conditions.push('b.customer_id = ?');
      params.push(customerId);
    }
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      conditions.push('b.start_time < ? AND b.end_time > ?');
      params.push(endOfDay.toISOString(), startOfDay.toISOString());
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY b.start_time DESC';
    
    const bookings = db.prepare(sql).all(...params);
    
    const bookingsWithDevices = bookings.map(booking => {
      const devices = db.prepare(`
        SELECT bd.*, d.name as device_name, d.category as device_category
        FROM booking_devices bd
        JOIN devices d ON bd.device_id = d.id
        WHERE bd.booking_id = ?
      `).all(booking.id);
      
      return {
        ...booking,
        devices
      };
    });
    
    res.json({ success: true, data: bookingsWithDevices });
  } catch (err) {
    next(err);
  }
}

function getBookingById(req, res, next) {
  try {
    const { id } = req.params;
    
    const booking = db.prepare(`
      SELECT b.*, 
             r.name as room_name, r.type as room_type, r.base_rate_per_hour,
             c.name as customer_name, c.phone as customer_phone, c.email as customer_email
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      JOIN customers c ON b.customer_id = c.id
      WHERE b.id = ?
    `).get(id);
    
    if (!booking) {
      throw new NotFoundError('预约不存在', 'booking');
    }
    
    const devices = db.prepare(`
      SELECT bd.*, d.name as device_name, d.category as device_category, d.model as device_model
      FROM booking_devices bd
      JOIN devices d ON bd.device_id = d.id
      WHERE bd.booking_id = ?
    `).all(booking.id);
    
    const depositTransactions = db.prepare(`
      SELECT * FROM deposit_transactions WHERE booking_id = ? ORDER BY created_at DESC
    `).all(booking.id);
    
    const damageRecords = db.prepare(`
      SELECT dr.*, d.name as device_name, r.name as room_name
      FROM damage_records dr
      LEFT JOIN devices d ON dr.device_id = d.id
      LEFT JOIN rooms r ON dr.room_id = r.id
      WHERE dr.booking_id = ?
      ORDER BY created_at DESC
    `).all(booking.id);
    
    const statusLogs = db.prepare(`
      SELECT * FROM booking_status_logs WHERE booking_id = ? ORDER BY created_at DESC
    `).all(booking.id);
    
    res.json({
      success: true,
      data: {
        ...booking,
        devices,
        depositTransactions,
        damageRecords,
        statusLogs
      }
    });
  } catch (err) {
    next(err);
  }
}

function createBooking(req, res, next) {
  try {
    const { customerId, roomId, startTime, endTime, deviceIds, notes, createdBy } = req.body;
    
    if (!customerId || !roomId || !startTime || !endTime) {
      throw new ValidationError('缺少必填字段：customerId, roomId, startTime, endTime');
    }
    
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!customer) {
      throw new NotFoundError('客户不存在', 'customer');
    }
    
    const room = db.prepare('SELECT * FROM rooms WHERE id = ? AND status = ?').get(roomId, 'active');
    if (!room) {
      throw new NotFoundError('房间不存在或不可用', 'room');
    }
    
    if (new Date(endTime) <= new Date(startTime)) {
      throw new ValidationError('结束时间必须晚于开始时间', 'endTime');
    }
    
    const validDeviceIds = [];
    if (deviceIds && deviceIds.length > 0) {
      const placeholders = deviceIds.map(() => '?').join(',');
      const devices = db.prepare(`
        SELECT id FROM devices WHERE id IN (${placeholders}) AND status = ?
      `).all(...deviceIds, 'available');
      
      if (devices.length !== deviceIds.length) {
        throw new ValidationError('部分设备不存在或不可用', 'deviceIds');
      }
      validDeviceIds.push(...devices.map(d => d.id));
    }
    
    validateBookingCreation(roomId, startTime, endTime, validDeviceIds);
    
    const roomFee = calculateRoomFee(roomId, startTime, endTime);
    const deviceFee = calculateDeviceFee(validDeviceIds, startTime, endTime);
    
    const baseAmount = roomFee.totalAmount;
    const deviceAmount = deviceFee.totalAmount;
    const totalAmount = baseAmount + deviceAmount;
    
    const depositRequired = calculateDepositRequired(roomId, validDeviceIds);
    
    const bookingNumber = generateBookingNumber();
    
    const stmt = db.prepare(`
      INSERT INTO bookings (
        booking_number, customer_id, room_id, start_time, end_time,
        status, base_amount, device_amount, total_amount, deposit_amount,
        notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      bookingNumber,
      customerId,
      roomId,
      startTime,
      endTime,
      BOOKING_STATES.PENDING_CONFIRMATION,
      baseAmount,
      deviceAmount,
      totalAmount,
      0,
      notes || null,
      createdBy || null
    );
    
    const bookingId = result.lastInsertRowid;
    
    if (validDeviceIds.length > 0) {
      const insertDeviceStmt = db.prepare(`
        INSERT INTO booking_devices (booking_id, device_id, rental_rate, deposit_required, status)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      deviceFee.devices.forEach(device => {
        insertDeviceStmt.run(
          bookingId,
          device.deviceId,
          device.hourlyRate,
          device.depositRequired,
          'reserved'
        );
      });
    }
    
    const createdBooking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
    const createdDevices = db.prepare(`
      SELECT bd.*, d.name as device_name FROM booking_devices bd
      JOIN devices d ON bd.device_id = d.id
      WHERE bd.booking_id = ?
    `).all(bookingId);
    
    res.status(201).json({
      success: true,
      data: {
        ...createdBooking,
        devices: createdDevices,
        pricing: {
          roomFee,
          deviceFee,
          depositRequired
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

function updateBooking(req, res, next) {
  try {
    const { id } = req.params;
    const { startTime, endTime, roomId, notes } = req.body;
    
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!booking) {
      throw new NotFoundError('预约不存在', 'booking');
    }
    
    if (!isModifiableState(booking.status)) {
      throw new ValidationError(`预约状态 "${getStateDisplayName(booking.status)}" 不允许修改`, 'status');
    }
    
    const newRoomId = roomId || booking.room_id;
    const newStartTime = startTime || booking.start_time;
    const newEndTime = endTime || booking.end_time;
    
    const currentDeviceIds = db.prepare('SELECT device_id FROM booking_devices WHERE booking_id = ?').all(id).map(d => d.device_id);
    
    validateBookingModification(id, newRoomId, newStartTime, newEndTime, currentDeviceIds);
    
    const roomFee = calculateRoomFee(newRoomId, newStartTime, newEndTime);
    const deviceFee = calculateDeviceFee(currentDeviceIds, newStartTime, newEndTime);
    
    const baseAmount = roomFee.totalAmount;
    const deviceAmount = deviceFee.totalAmount;
    const totalAmount = baseAmount + deviceAmount;
    
    const updateFields = [];
    const updateParams = [];
    
    if (startTime !== undefined) {
      updateFields.push('start_time = ?');
      updateParams.push(startTime);
    }
    if (endTime !== undefined) {
      updateFields.push('end_time = ?');
      updateParams.push(endTime);
    }
    if (roomId !== undefined) {
      updateFields.push('room_id = ?');
      updateParams.push(roomId);
    }
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateParams.push(notes);
    }
    
    updateFields.push('base_amount = ?');
    updateParams.push(baseAmount);
    updateFields.push('device_amount = ?');
    updateParams.push(deviceAmount);
    updateFields.push('total_amount = ?');
    updateParams.push(totalAmount);
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateParams.push(id);
    
    const stmt = db.prepare(`
      UPDATE bookings SET ${updateFields.join(', ')} WHERE id = ?
    `);
    stmt.run(...updateParams);
    
    const updatedBooking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    const devices = db.prepare(`
      SELECT bd.*, d.name as device_name FROM booking_devices bd
      JOIN devices d ON bd.device_id = d.id
      WHERE bd.booking_id = ?
    `).all(id);
    
    res.json({
      success: true,
      data: {
        ...updatedBooking,
        devices,
        pricing: {
          roomFee,
          deviceFee
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

function cancelBooking(req, res, next) {
  try {
    const { id } = req.params;
    const { reason, cancelledBy } = req.body;
    
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!booking) {
      throw new NotFoundError('预约不存在', 'booking');
    }
    
    const updatedBooking = updateBookingStatus(id, BOOKING_STATES.CANCELLED, cancelledBy, reason);
    
    db.prepare(`
      UPDATE booking_devices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE booking_id = ?
    `).run('cancelled', id);
    
    res.json({
      success: true,
      data: updatedBooking,
      message: '预约已取消'
    });
  } catch (err) {
    next(err);
  }
}

function payDeposit(req, res, next) {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, referenceNumber, notes, paidBy } = req.body;
    
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!booking) {
      throw new NotFoundError('预约不存在', 'booking');
    }
    
    if (booking.status !== BOOKING_STATES.PENDING_CONFIRMATION) {
      throw new ValidationError(`只能在"待确认"状态支付押金，当前状态：${getStateDisplayName(booking.status)}`, 'status');
    }
    
    if (!amount || amount <= 0) {
      throw new ValidationError('押金金额必须大于0', 'amount');
    }
    
    const depositCheck = checkDepositSufficient(id, amount);
    if (!depositCheck.sufficient) {
      throw new InsufficientDepositError(
        `押金不足，需要 ${depositCheck.required} 元，当前支付 ${depositCheck.provided} 元，还需 ${depositCheck.deficit} 元`,
        depositCheck.required,
        depositCheck.provided
      );
    }
    
    const newDepositAmount = (booking.deposit_amount || 0) + Number(amount);
    
    const transactionStmt = db.prepare(`
      INSERT INTO deposit_transactions (booking_id, transaction_type, amount, payment_method, reference_number, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    transactionStmt.run(id, 'deposit', Number(amount), paymentMethod || null, referenceNumber || null, notes || null, paidBy || null);
    
    db.prepare(`
      UPDATE bookings SET deposit_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(newDepositAmount, id);
    
    const updatedBooking = updateBookingStatus(id, BOOKING_STATES.DEPOSIT_PAID, paidBy, '支付押金');
    
    const transactions = db.prepare(`
      SELECT * FROM deposit_transactions WHERE booking_id = ? ORDER BY created_at DESC
    `).all(id);
    
    res.json({
      success: true,
      data: {
        booking: updatedBooking,
        depositTransactions: transactions,
        depositCheck
      }
    });
  } catch (err) {
    next(err);
  }
}

function checkIn(req, res, next) {
  try {
    const { id } = req.params;
    const { checkedBy, actualStartTime } = req.body;
    
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!booking) {
      throw new NotFoundError('预约不存在', 'booking');
    }
    
    if (booking.status !== BOOKING_STATES.DEPOSIT_PAID) {
      throw new ValidationError(`只能在"已付押金"状态到店，当前状态：${getStateDisplayName(booking.status)}`, 'status');
    }
    
    const actualStart = actualStartTime || new Date().toISOString();
    
    db.prepare(`
      UPDATE bookings SET actual_start_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(actualStart, id);
    
    const updatedBooking = updateBookingStatus(id, BOOKING_STATES.CHECKED_IN, checkedBy, '到店登记');
    
    db.prepare(`
      UPDATE booking_devices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE booking_id = ?
    `).run('in_use', id);
    
    res.json({
      success: true,
      data: updatedBooking,
      message: '已到店登记'
    });
  } catch (err) {
    next(err);
  }
}

function startUse(req, res, next) {
  try {
    const { id } = req.params;
    const { startedBy } = req.body;
    
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!booking) {
      throw new NotFoundError('预约不存在', 'booking');
    }
    
    if (booking.status !== BOOKING_STATES.CHECKED_IN) {
      throw new ValidationError(`只能在"已到店"状态开始使用，当前状态：${getStateDisplayName(booking.status)}`, 'status');
    }
    
    const updatedBooking = updateBookingStatus(id, BOOKING_STATES.IN_USE, startedBy, '开始使用');
    
    res.json({
      success: true,
      data: updatedBooking,
      message: '已开始使用'
    });
  } catch (err) {
    next(err);
  }
}

function addDevices(req, res, next) {
  try {
    const { id } = req.params;
    const { deviceIds, addedBy } = req.body;
    
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!booking) {
      throw new NotFoundError('预约不存在', 'booking');
    }
    
    if (!isModifiableState(booking.status)) {
      throw new ValidationError(`预约状态 "${getStateDisplayName(booking.status)}" 不允许添加设备`, 'status');
    }
    
    if (!deviceIds || deviceIds.length === 0) {
      throw new ValidationError('请指定要添加的设备', 'deviceIds');
    }
    
    const currentDeviceIds = db.prepare('SELECT device_id FROM booking_devices WHERE booking_id = ?').all(id).map(d => d.device_id);
    const newDeviceIds = deviceIds.filter(dId => !currentDeviceIds.includes(dId));
    
    if (newDeviceIds.length === 0) {
      throw new ValidationError('所有设备已添加到预约中', 'deviceIds');
    }
    
    const placeholders = newDeviceIds.map(() => '?').join(',');
    const devices = db.prepare(`
      SELECT * FROM devices WHERE id IN (${placeholders}) AND status = ?
    `).all(...newDeviceIds, 'available');
    
    if (devices.length !== newDeviceIds.length) {
      throw new ValidationError('部分设备不存在或不可用', 'deviceIds');
    }
    
    validateBookingModification(id, booking.room_id, booking.start_time, booking.end_time, [...currentDeviceIds, ...newDeviceIds]);
    
    const deviceFee = calculateDeviceFee(newDeviceIds, booking.start_time, booking.end_time);
    
    const insertDeviceStmt = db.prepare(`
      INSERT INTO booking_devices (booking_id, device_id, rental_rate, deposit_required, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    deviceFee.devices.forEach(device => {
      insertDeviceStmt.run(
        id,
        device.deviceId,
        device.hourlyRate,
        device.depositRequired,
        booking.status === BOOKING_STATES.IN_USE ? 'in_use' : 'reserved'
      );
    });
    
    const newDeviceAmount = booking.device_amount + deviceFee.totalAmount;
    const newTotalAmount = booking.total_amount + deviceFee.totalAmount;
    
    db.prepare(`
      UPDATE bookings SET device_amount = ?, total_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(newDeviceAmount, newTotalAmount, id);
    
    const updatedBooking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    const allDevices = db.prepare(`
      SELECT bd.*, d.name as device_name FROM booking_devices bd
      JOIN devices d ON bd.device_id = d.id
      WHERE bd.booking_id = ?
    `).all(id);
    
    const newDepositRequired = calculateDepositRequired(booking.room_id, [...currentDeviceIds, ...newDeviceIds]);
    const currentDeposit = booking.deposit_amount || 0;
    
    res.json({
      success: true,
      data: {
        booking: updatedBooking,
        devices: allDevices,
        addedDevices: deviceFee.devices,
        depositWarning: {
          currentDeposit,
          requiredDeposit: newDepositRequired.totalDeposit,
          deficit: Math.max(0, newDepositRequired.totalDeposit - currentDeposit)
        }
      },
      message: `已添加 ${newDeviceIds.length} 个设备`
    });
  } catch (err) {
    next(err);
  }
}

function removeDevices(req, res, next) {
  try {
    const { id } = req.params;
    const { deviceIds, removedBy } = req.body;
    
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!booking) {
      throw new NotFoundError('预约不存在', 'booking');
    }
    
    if (!isModifiableState(booking.status)) {
      throw new ValidationError(`预约状态 "${getStateDisplayName(booking.status)}" 不允许移除设备`, 'status');
    }
    
    if (!deviceIds || deviceIds.length === 0) {
      throw new ValidationError('请指定要移除的设备', 'deviceIds');
    }
    
    const currentDevices = db.prepare(`
      SELECT bd.*, d.name as device_name, d.rental_rate_per_hour
      FROM booking_devices bd
      JOIN devices d ON bd.device_id = d.id
      WHERE bd.booking_id = ? AND bd.device_id IN (${deviceIds.map(() => '?').join(',')})
    `).all(id, ...deviceIds);
    
    if (currentDevices.length !== deviceIds.length) {
      throw new ValidationError('部分设备不在此预约中', 'deviceIds');
    }
    
    const durationHours = calculateDurationHours(booking.start_time, booking.end_time);
    let removedAmount = 0;
    let removedDeposit = 0;
    
    currentDevices.forEach(device => {
      removedAmount += device.rental_rate * durationHours;
      removedDeposit += device.deposit_required;
    });
    
    db.prepare(`
      DELETE FROM booking_devices WHERE booking_id = ? AND device_id IN (${deviceIds.map(() => '?').join(',')})
    `).run(id, ...deviceIds);
    
    const newDeviceAmount = Math.max(0, booking.device_amount - removedAmount);
    const newTotalAmount = Math.max(0, booking.total_amount - removedAmount);
    
    db.prepare(`
      UPDATE bookings SET device_amount = ?, total_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(newDeviceAmount, newTotalAmount, id);
    
    const updatedBooking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    const remainingDevices = db.prepare(`
      SELECT bd.*, d.name as device_name FROM booking_devices bd
      JOIN devices d ON bd.device_id = d.id
      WHERE bd.booking_id = ?
    `).all(id);
    
    res.json({
      success: true,
      data: {
        booking: updatedBooking,
        devices: remainingDevices,
        removedDevices: currentDevices.map(d => ({
          deviceId: d.device_id,
          deviceName: d.device_name,
          rentalAmount: Number((d.rental_rate * durationHours).toFixed(2)),
          depositRequired: d.deposit_required
        }))
      },
      message: `已移除 ${currentDevices.length} 个设备`
    });
  } catch (err) {
    next(err);
  }
}

function calculateDurationHours(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end - start;
  const durationHours = durationMs / (1000 * 60 * 60);
  return Math.max(0.5, Math.ceil(durationHours * 2) / 2);
}

module.exports = {
  getAllBookings,
  getBookingById,
  createBooking,
  updateBooking,
  cancelBooking,
  payDeposit,
  checkIn,
  startUse,
  addDevices,
  removeDevices
};
