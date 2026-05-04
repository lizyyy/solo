const db = require('../config/database');
const { NotFoundError, ValidationError } = require('../utils/errors');

function getAllRooms(req, res, next) {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM rooms';
    const params = [];
    
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    
    const rooms = db.prepare(sql).all(...params);
    res.json({ success: true, data: rooms });
  } catch (err) {
    next(err);
  }
}

function getRoomById(req, res, next) {
  try {
    const { id } = req.params;
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    
    if (!room) {
      throw new NotFoundError('房间不存在', 'room');
    }
    
    res.json({ success: true, data: room });
  } catch (err) {
    next(err);
  }
}

function createRoom(req, res, next) {
  try {
    const { name, type, capacity, baseRatePerHour, equipment, status } = req.body;
    
    if (!name || !type || baseRatePerHour === undefined) {
      throw new ValidationError('缺少必填字段：name, type, baseRatePerHour');
    }
    
    const existingRoom = db.prepare('SELECT id FROM rooms WHERE name = ?').get(name);
    if (existingRoom) {
      throw new ValidationError('房间名称已存在', 'name');
    }
    
    const stmt = db.prepare(`
      INSERT INTO rooms (name, type, capacity, base_rate_per_hour, equipment, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      name,
      type,
      capacity || 0,
      Number(baseRatePerHour),
      equipment || null,
      status || 'active'
    );
    
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: room });
  } catch (err) {
    next(err);
  }
}

function updateRoom(req, res, next) {
  try {
    const { id } = req.params;
    const { name, type, capacity, baseRatePerHour, equipment, status } = req.body;
    
    const existingRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!existingRoom) {
      throw new NotFoundError('房间不存在', 'room');
    }
    
    if (name && name !== existingRoom.name) {
      const duplicateName = db.prepare('SELECT id FROM rooms WHERE name = ? AND id != ?').get(name, id);
      if (duplicateName) {
        throw new ValidationError('房间名称已存在', 'name');
      }
    }
    
    const updateFields = [];
    const updateParams = [];
    
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateParams.push(name);
    }
    if (type !== undefined) {
      updateFields.push('type = ?');
      updateParams.push(type);
    }
    if (capacity !== undefined) {
      updateFields.push('capacity = ?');
      updateParams.push(capacity);
    }
    if (baseRatePerHour !== undefined) {
      updateFields.push('base_rate_per_hour = ?');
      updateParams.push(Number(baseRatePerHour));
    }
    if (equipment !== undefined) {
      updateFields.push('equipment = ?');
      updateParams.push(equipment);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateParams.push(status);
    }
    
    if (updateFields.length > 0) {
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateParams.push(id);
      
      const stmt = db.prepare(`
        UPDATE rooms SET ${updateFields.join(', ')} WHERE id = ?
      `);
      stmt.run(...updateParams);
    }
    
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    res.json({ success: true, data: room });
  } catch (err) {
    next(err);
  }
}

function deleteRoom(req, res, next) {
  try {
    const { id } = req.params;
    
    const existingRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!existingRoom) {
      throw new NotFoundError('房间不存在', 'room');
    }
    
    const activeBookings = db.prepare(`
      SELECT id FROM bookings 
      WHERE room_id = ? 
      AND status IN ('pending_confirmation', 'deposit_paid', 'checked_in', 'in_use', 'pending_settlement')
    `).all(id);
    
    if (activeBookings.length > 0) {
      throw new ValidationError('房间存在活跃预约，无法删除', 'room');
    }
    
    db.prepare('DELETE FROM rooms WHERE id = ?').run(id);
    res.json({ success: true, message: '房间已删除' });
  } catch (err) {
    next(err);
  }
}

function getRoomAvailability(req, res, next) {
  try {
    const { id } = req.params;
    const { date } = req.query;
    
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
    if (!room) {
      throw new NotFoundError('房间不存在', 'room');
    }
    
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const bookings = db.prepare(`
      SELECT id, booking_number, start_time, end_time, status
      FROM bookings
      WHERE room_id = ?
      AND start_time < ?
      AND end_time > ?
      AND status IN ('pending_confirmation', 'deposit_paid', 'checked_in', 'in_use', 'pending_settlement')
      ORDER BY start_time
    `).all(id, endOfDay.toISOString(), startOfDay.toISOString());
    
    res.json({
      success: true,
      data: {
        roomId: id,
        roomName: room.name,
        date: targetDate,
        bookedSlots: bookings.map(b => ({
          bookingId: b.id,
          bookingNumber: b.booking_number,
          startTime: b.start_time,
          endTime: b.end_time,
          status: b.status
        }))
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  getRoomAvailability
};
