const db = require('../config/database');
const { ConflictError } = require('../utils/errors');
const { isActiveState } = require('./bookingStateService');

function checkRoomConflict(roomId, startTime, endTime, excludeBookingId = null) {
  let sql = `
    SELECT b.id, b.booking_number, b.start_time, b.end_time, b.status, r.name as room_name
    FROM bookings b
    JOIN rooms r ON b.room_id = r.id
    WHERE b.room_id = ?
    AND b.status IN ('pending_confirmation', 'deposit_paid', 'checked_in', 'in_use', 'pending_settlement')
    AND (
      (b.start_time < ? AND b.end_time > ?)
      OR (b.start_time >= ? AND b.start_time < ?)
      OR (b.end_time > ? AND b.end_time <= ?)
    )
  `;
  
  const params = [roomId, endTime, startTime, startTime, endTime, startTime, endTime];
  
  if (excludeBookingId) {
    sql += ' AND b.id != ?';
    params.push(excludeBookingId);
  }
  
  const conflicts = db.prepare(sql).all(...params);
  
  return conflicts;
}

function checkDeviceConflict(deviceIds, startTime, endTime, excludeBookingId = null) {
  if (!deviceIds || deviceIds.length === 0) {
    return [];
  }
  
  const placeholders = deviceIds.map(() => '?').join(',');
  
  let sql = `
    SELECT bd.id, bd.booking_id, b.booking_number, bd.device_id, d.name as device_name,
           b.start_time, b.end_time, b.status
    FROM booking_devices bd
    JOIN bookings b ON bd.booking_id = b.id
    JOIN devices d ON bd.device_id = d.id
    WHERE bd.device_id IN (${placeholders})
    AND b.status IN ('pending_confirmation', 'deposit_paid', 'checked_in', 'in_use', 'pending_settlement')
    AND bd.status IN ('reserved', 'in_use')
    AND (
      (b.start_time < ? AND b.end_time > ?)
      OR (b.start_time >= ? AND b.start_time < ?)
      OR (b.end_time > ? AND b.end_time <= ?)
    )
  `;
  
  const params = [...deviceIds, endTime, startTime, startTime, endTime, startTime, endTime];
  
  if (excludeBookingId) {
    sql += ' AND b.id != ?';
    params.push(excludeBookingId);
  }
  
  const conflicts = db.prepare(sql).all(...params);
  
  return conflicts;
}

function validateBookingCreation(roomId, startTime, endTime, deviceIds = []) {
  const conflicts = [];
  
  const roomConflicts = checkRoomConflict(roomId, startTime, endTime);
  if (roomConflicts.length > 0) {
    conflicts.push({
      type: 'room',
      message: `房间时间冲突`,
      details: roomConflicts.map(c => ({
        bookingId: c.id,
        bookingNumber: c.booking_number,
        startTime: c.start_time,
        endTime: c.end_time,
        status: c.status
      }))
    });
  }
  
  if (deviceIds && deviceIds.length > 0) {
    const deviceConflicts = checkDeviceConflict(deviceIds, startTime, endTime);
    if (deviceConflicts.length > 0) {
      const groupedConflicts = {};
      deviceConflicts.forEach(c => {
        if (!groupedConflicts[c.device_id]) {
          groupedConflicts[c.device_id] = {
            deviceId: c.device_id,
            deviceName: c.device_name,
            conflicts: []
          };
        }
        groupedConflicts[c.device_id].conflicts.push({
          bookingId: c.booking_id,
          bookingNumber: c.booking_number,
          startTime: c.start_time,
          endTime: c.end_time,
          status: c.status
        });
      });
      
      conflicts.push({
        type: 'device',
        message: `设备占用冲突`,
        details: Object.values(groupedConflicts)
      });
    }
  }
  
  if (conflicts.length > 0) {
    throw new ConflictError('预约存在冲突，请检查房间和设备可用性', conflicts);
  }
  
  return true;
}

function validateBookingModification(bookingId, roomId, startTime, endTime, deviceIds = []) {
  const conflicts = [];
  
  const roomConflicts = checkRoomConflict(roomId, startTime, endTime, bookingId);
  if (roomConflicts.length > 0) {
    conflicts.push({
      type: 'room',
      message: `房间时间冲突`,
      details: roomConflicts.map(c => ({
        bookingId: c.id,
        bookingNumber: c.booking_number,
        startTime: c.start_time,
        endTime: c.end_time,
        status: c.status
      }))
    });
  }
  
  if (deviceIds && deviceIds.length > 0) {
    const deviceConflicts = checkDeviceConflict(deviceIds, startTime, endTime, bookingId);
    if (deviceConflicts.length > 0) {
      const groupedConflicts = {};
      deviceConflicts.forEach(c => {
        if (!groupedConflicts[c.device_id]) {
          groupedConflicts[c.device_id] = {
            deviceId: c.device_id,
            deviceName: c.device_name,
            conflicts: []
          };
        }
        groupedConflicts[c.device_id].conflicts.push({
          bookingId: c.booking_id,
          bookingNumber: c.booking_number,
          startTime: c.start_time,
          endTime: c.end_time,
          status: c.status
        });
      });
      
      conflicts.push({
        type: 'device',
        message: `设备占用冲突`,
        details: Object.values(groupedConflicts)
      });
    }
  }
  
  if (conflicts.length > 0) {
    throw new ConflictError('修改后的预约存在冲突，请检查房间和设备可用性', conflicts);
  }
  
  return true;
}

function getRoomAvailability(roomId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const bookings = db.prepare(`
    SELECT id, booking_number, start_time, end_time, status
    FROM bookings
    WHERE room_id = ?
    AND start_time < ?
    AND end_time > ?
    AND status IN ('pending_confirmation', 'deposit_paid', 'checked_in', 'in_use', 'pending_settlement')
    ORDER BY start_time
  `).all(roomId, endOfDay.toISOString(), startOfDay.toISOString());
  
  return {
    roomId,
    date,
    bookedSlots: bookings.map(b => ({
      bookingId: b.id,
      bookingNumber: b.booking_number,
      startTime: b.start_time,
      endTime: b.end_time,
      status: b.status
    }))
  };
}

function getDeviceAvailability(deviceId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const bookings = db.prepare(`
    SELECT b.id, b.booking_number, b.start_time, b.end_time, b.status, bd.status as device_status
    FROM booking_devices bd
    JOIN bookings b ON bd.booking_id = b.id
    WHERE bd.device_id = ?
    AND b.start_time < ?
    AND b.end_time > ?
    AND b.status IN ('pending_confirmation', 'deposit_paid', 'checked_in', 'in_use', 'pending_settlement')
    AND bd.status IN ('reserved', 'in_use')
    ORDER BY b.start_time
  `).all(deviceId, endOfDay.toISOString(), startOfDay.toISOString());
  
  return {
    deviceId,
    date,
    bookedSlots: bookings.map(b => ({
      bookingId: b.id,
      bookingNumber: b.booking_number,
      startTime: b.start_time,
      endTime: b.end_time,
      status: b.status,
      deviceStatus: b.device_status
    }))
  };
}

module.exports = {
  checkRoomConflict,
  checkDeviceConflict,
  validateBookingCreation,
  validateBookingModification,
  getRoomAvailability,
  getDeviceAvailability
};
