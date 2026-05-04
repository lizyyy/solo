const db = require('../config/database');
const { NotFoundError, ValidationError } = require('../utils/errors');

function getAllDevices(req, res, next) {
  try {
    const { category, status } = req.query;
    let sql = 'SELECT * FROM devices';
    const params = [];
    const conditions = [];
    
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY category, name';
    
    const devices = db.prepare(sql).all(...params);
    res.json({ success: true, data: devices });
  } catch (err) {
    next(err);
  }
}

function getDeviceById(req, res, next) {
  try {
    const { id } = req.params;
    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
    
    if (!device) {
      throw new NotFoundError('设备不存在', 'device');
    }
    
    res.json({ success: true, data: device });
  } catch (err) {
    next(err);
  }
}

function createDevice(req, res, next) {
  try {
    const { name, category, model, serialNumber, rentalRatePerHour, depositRequired, status, condition, notes } = req.body;
    
    if (!name || !category) {
      throw new ValidationError('缺少必填字段：name, category');
    }
    
    if (serialNumber) {
      const existingDevice = db.prepare('SELECT id FROM devices WHERE serial_number = ?').get(serialNumber);
      if (existingDevice) {
        throw new ValidationError('设备序列号已存在', 'serialNumber');
      }
    }
    
    const stmt = db.prepare(`
      INSERT INTO devices (name, category, model, serial_number, rental_rate_per_hour, deposit_required, status, condition, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      name,
      category,
      model || null,
      serialNumber || null,
      Number(rentalRatePerHour || 0),
      Number(depositRequired || 0),
      status || 'available',
      condition || 'good',
      notes || null
    );
    
    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: device });
  } catch (err) {
    next(err);
  }
}

function updateDevice(req, res, next) {
  try {
    const { id } = req.params;
    const { name, category, model, serialNumber, rentalRatePerHour, depositRequired, status, condition, notes } = req.body;
    
    const existingDevice = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
    if (!existingDevice) {
      throw new NotFoundError('设备不存在', 'device');
    }
    
    if (serialNumber && serialNumber !== existingDevice.serial_number) {
      const duplicateSerial = db.prepare('SELECT id FROM devices WHERE serial_number = ? AND id != ?').get(serialNumber, id);
      if (duplicateSerial) {
        throw new ValidationError('设备序列号已存在', 'serialNumber');
      }
    }
    
    const updateFields = [];
    const updateParams = [];
    
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateParams.push(name);
    }
    if (category !== undefined) {
      updateFields.push('category = ?');
      updateParams.push(category);
    }
    if (model !== undefined) {
      updateFields.push('model = ?');
      updateParams.push(model);
    }
    if (serialNumber !== undefined) {
      updateFields.push('serial_number = ?');
      updateParams.push(serialNumber);
    }
    if (rentalRatePerHour !== undefined) {
      updateFields.push('rental_rate_per_hour = ?');
      updateParams.push(Number(rentalRatePerHour));
    }
    if (depositRequired !== undefined) {
      updateFields.push('deposit_required = ?');
      updateParams.push(Number(depositRequired));
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateParams.push(status);
    }
    if (condition !== undefined) {
      updateFields.push('condition = ?');
      updateParams.push(condition);
    }
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateParams.push(notes);
    }
    
    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateParams.push(id);
      
      const stmt = db.prepare(`
        UPDATE devices SET ${updateFields.join(', ')} WHERE id = ?
      `);
      stmt.run(...updateParams);
    }
    
    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
    res.json({ success: true, data: device });
  } catch (err) {
    next(err);
  }
}

function deleteDevice(req, res, next) {
  try {
    const { id } = req.params;
    
    const existingDevice = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
    if (!existingDevice) {
      throw new NotFoundError('设备不存在', 'device');
    }
    
    const activeBookings = db.prepare(`
      SELECT bd.id FROM booking_devices bd
      JOIN bookings b ON bd.booking_id = b.id
      WHERE bd.device_id = ?
      AND b.status IN ('pending_confirmation', 'deposit_paid', 'checked_in', 'in_use', 'pending_settlement')
      AND bd.status IN ('reserved', 'in_use')
    `).all(id);
    
    if (activeBookings.length > 0) {
      throw new ValidationError('设备存在活跃预约，无法删除', 'device');
    }
    
    db.prepare('DELETE FROM devices WHERE id = ?').run(id);
    res.json({ success: true, message: '设备已删除' });
  } catch (err) {
    next(err);
  }
}

function getDeviceAvailability(req, res, next) {
  try {
    const { id } = req.params;
    const { date } = req.query;
    
    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
    if (!device) {
      throw new NotFoundError('设备不存在', 'device');
    }
    
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
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
    `).all(id, endOfDay.toISOString(), startOfDay.toISOString());
    
    res.json({
      success: true,
      data: {
        deviceId: id,
        deviceName: device.name,
        date: targetDate,
        bookedSlots: bookings.map(b => ({
          bookingId: b.id,
          bookingNumber: b.booking_number,
          startTime: b.start_time,
          endTime: b.end_time,
          status: b.status,
          deviceStatus: b.device_status
        }))
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  getDeviceAvailability
};
