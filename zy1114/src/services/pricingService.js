const db = require('../config/database');
const { AmountError } = require('../utils/errors');

function calculateDurationHours(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end - start;
  
  if (durationMs < 0) {
    throw new AmountError('结束时间不能早于开始时间', 'duration');
  }
  
  const durationHours = durationMs / (1000 * 60 * 60);
  return Math.max(0.5, Math.ceil(durationHours * 2) / 2);
}

function calculateRoomFee(roomId, startTime, endTime) {
  const room = db.prepare('SELECT base_rate_per_hour FROM rooms WHERE id = ?').get(roomId);
  if (!room) {
    throw new AmountError('房间不存在', 'room');
  }
  
  const durationHours = calculateDurationHours(startTime, endTime);
  const roomFee = room.base_rate_per_hour * durationHours;
  
  return {
    roomId,
    startTime,
    endTime,
    durationHours,
    hourlyRate: room.base_rate_per_hour,
    totalAmount: Number(roomFee.toFixed(2))
  };
}

function calculateDeviceFee(deviceIds, startTime, endTime) {
  if (!deviceIds || deviceIds.length === 0) {
    return {
      devices: [],
      totalAmount: 0
    };
  }
  
  const placeholders = deviceIds.map(() => '?').join(',');
  const devices = db.prepare(`
    SELECT id, name, rental_rate_per_hour, deposit_required
    FROM devices WHERE id IN (${placeholders})
  `).all(...deviceIds);
  
  const durationHours = calculateDurationHours(startTime, endTime);
  
  const deviceDetails = devices.map(device => {
    const rentalFee = device.rental_rate_per_hour * durationHours;
    return {
      deviceId: device.id,
      deviceName: device.name,
      hourlyRate: device.rental_rate_per_hour,
      depositRequired: device.deposit_required,
      durationHours,
      rentalAmount: Number(rentalFee.toFixed(2))
    };
  });
  
  const totalAmount = deviceDetails.reduce((sum, d) => sum + d.rentalAmount, 0);
  const totalDepositRequired = deviceDetails.reduce((sum, d) => sum + d.depositRequired, 0);
  
  return {
    devices: deviceDetails,
    totalAmount: Number(totalAmount.toFixed(2)),
    totalDepositRequired: Number(totalDepositRequired.toFixed(2))
  };
}

function calculateOvertimeFee(bookingId, actualEndTime) {
  const booking = db.prepare(`
    SELECT b.id, b.end_time, b.room_id, r.base_rate_per_hour
    FROM bookings b
    JOIN rooms r ON b.room_id = r.id
    WHERE b.id = ?
  `).get(bookingId);
  
  if (!booking) {
    throw new AmountError('预约不存在', 'booking');
  }
  
  const scheduledEnd = new Date(booking.end_time);
  const actualEnd = new Date(actualEndTime);
  
  if (actualEnd <= scheduledEnd) {
    return {
      overtime: false,
      overtimeHours: 0,
      overtimeAmount: 0,
      message: '未超时'
    };
  }
  
  const overtimeHours = calculateDurationHours(booking.end_time, actualEndTime);
  const overtimeRate = booking.base_rate_per_hour * 1.5;
  const overtimeAmount = overtimeRate * overtimeHours;
  
  return {
    overtime: true,
    scheduledEndTime: booking.end_time,
    actualEndTime,
    overtimeHours,
    hourlyRate: booking.base_rate_per_hour,
    overtimeRate,
    overtimeAmount: Number(overtimeAmount.toFixed(2)),
    message: `超时 ${overtimeHours} 小时，超时费率为 ${overtimeRate} 元/小时（原价1.5倍）`
  };
}

function calculateBookingTotal(bookingId) {
  const booking = db.prepare(`
    SELECT b.*, r.base_rate_per_hour
    FROM bookings b
    JOIN rooms r ON b.room_id = r.id
    WHERE b.id = ?
  `).get(bookingId);
  
  if (!booking) {
    throw new AmountError('预约不存在', 'booking');
  }
  
  const baseAmount = booking.base_amount || 0;
  const deviceAmount = booking.device_amount || 0;
  const overtimeAmount = booking.overtime_amount || 0;
  const damageAmount = booking.damage_amount || 0;
  
  const totalAmount = baseAmount + deviceAmount + overtimeAmount + damageAmount;
  
  return {
    bookingId,
    baseAmount,
    deviceAmount,
    overtimeAmount,
    damageAmount,
    totalAmount: Number(totalAmount.toFixed(2))
  };
}

function calculateDepositRequired(roomId, deviceIds = []) {
  const room = db.prepare('SELECT base_rate_per_hour FROM rooms WHERE id = ?').get(roomId);
  if (!room) {
    throw new AmountError('房间不存在', 'room');
  }
  
  const roomDeposit = room.base_rate_per_hour * 2;
  
  let deviceDeposit = 0;
  if (deviceIds && deviceIds.length > 0) {
    const placeholders = deviceIds.map(() => '?').join(',');
    const devices = db.prepare(`
      SELECT deposit_required FROM devices WHERE id IN (${placeholders})
    `).all(...deviceIds);
    
    deviceDeposit = devices.reduce((sum, d) => sum + (d.deposit_required || 0), 0);
  }
  
  const totalDeposit = roomDeposit + deviceDeposit;
  
  return {
    roomDeposit: Number(roomDeposit.toFixed(2)),
    deviceDeposit: Number(deviceDeposit.toFixed(2)),
    totalDeposit: Number(totalDeposit.toFixed(2))
  };
}

function calculateSettlement(bookingId, actualEndTime, damageRecords = []) {
  const booking = db.prepare(`
    SELECT b.*, r.base_rate_per_hour
    FROM bookings b
    JOIN rooms r ON b.room_id = r.id
    WHERE b.id = ?
  `).get(bookingId);
  
  if (!booking) {
    throw new AmountError('预约不存在', 'booking');
  }
  
  const baseAmount = booking.base_amount || 0;
  const deviceAmount = booking.device_amount || 0;
  
  const overtimeResult = calculateOvertimeFee(bookingId, actualEndTime);
  const overtimeAmount = overtimeResult.overtimeAmount;
  
  const damageAmount = damageRecords.reduce((sum, d) => sum + (d.estimatedCost || 0), 0);
  
  const totalAmount = baseAmount + deviceAmount + overtimeAmount + damageAmount;
  const depositPaid = booking.deposit_amount || 0;
  
  const balance = totalAmount - depositPaid;
  
  return {
    bookingId,
    baseAmount,
    deviceAmount,
    overtimeAmount,
    damageAmount,
    totalAmount: Number(totalAmount.toFixed(2)),
    depositPaid,
    balance: Number(balance.toFixed(2)),
    needsRefund: balance < 0,
    refundAmount: balance < 0 ? Number(Math.abs(balance).toFixed(2)) : 0,
    needsAdditionalPayment: balance > 0,
    additionalPaymentAmount: balance > 0 ? Number(balance.toFixed(2)) : 0,
    overtimeDetails: overtimeResult,
    damageRecords
  };
}

function checkDepositSufficient(bookingId, depositAmount) {
  const booking = db.prepare(`
    SELECT b.room_id
    FROM bookings b
    WHERE b.id = ?
  `).get(bookingId);
  
  if (!booking) {
    throw new AmountError('预约不存在', 'booking');
  }
  
  const deviceIds = db.prepare(`
    SELECT device_id FROM booking_devices WHERE booking_id = ?
  `).all(bookingId).map(d => d.device_id);
  
  const requiredDeposit = calculateDepositRequired(booking.room_id, deviceIds);
  
  return {
    provided: Number(depositAmount.toFixed(2)),
    required: requiredDeposit.totalDeposit,
    sufficient: depositAmount >= requiredDeposit.totalDeposit,
    deficit: Math.max(0, Number((requiredDeposit.totalDeposit - depositAmount).toFixed(2))),
    breakdown: requiredDeposit
  };
}

module.exports = {
  calculateDurationHours,
  calculateRoomFee,
  calculateDeviceFee,
  calculateOvertimeFee,
  calculateBookingTotal,
  calculateDepositRequired,
  calculateSettlement,
  checkDepositSufficient
};
