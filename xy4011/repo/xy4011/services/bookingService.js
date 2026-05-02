const db = require('../database/db');

const logOperation = (reservationId, action, details, operator = 'system') => {
  const stmt = db.prepare(`
    INSERT INTO operation_logs (reservation_id, action, details, operator)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(reservationId, action, JSON.stringify(details), operator);
};

const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const isTimeOverlapping = (start1, end1, start2, end2) => {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return !(e1 <= s2 || e2 <= s1);
};

const validateTimeSlot = (startTime, endTime) => {
  const errors = [];
  
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(startTime)) {
    errors.push('开始时间格式不正确，应为 HH:MM 格式');
  }
  if (!timeRegex.test(endTime)) {
    errors.push('结束时间格式不正确，应为 HH:MM 格式');
  }
  
  if (errors.length === 0) {
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      errors.push('开始时间必须早于结束时间');
    }
    
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    if (startMin < 480 || endMin > 1260) {
      errors.push('预约时间必须在 08:00-21:00 之间');
    }
    
    if (endMin - startMin < 30) {
      errors.push('预约时长至少为 30 分钟');
    }
  }
  
  return errors;
};

const validateDate = (date) => {
  const errors = [];
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  
  if (!dateRegex.test(date)) {
    errors.push('日期格式不正确，应为 YYYY-MM-DD 格式');
    return errors;
  }
  
  const selectedDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (selectedDate < today) {
    errors.push('不能预约过去的日期');
  }
  
  return errors;
};

const getRoomById = (roomId) => {
  return db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
};

const getConflictingReservations = (roomId, date, startTime, endTime, excludeId = null) => {
  let query = `
    SELECT r.*, rm.name as room_name
    FROM reservations r
    JOIN rooms rm ON r.room_id = rm.id
    WHERE r.room_id = ? 
      AND r.date = ? 
      AND r.status = 'confirmed'
  `;
  const params = [roomId, date];
  
  if (excludeId) {
    query += ' AND r.id != ?';
    params.push(excludeId);
  }
  
  const reservations = db.prepare(query).all(...params);
  
  return reservations.filter(res => 
    isTimeOverlapping(startTime, endTime, res.start_time, res.end_time)
  );
};

const getWaitlistForSlot = (roomId, date, startTime, endTime) => {
  return db.getWaitlistForSlot(roomId, date, startTime, endTime);
};

const getNextWaitlistPosition = (roomId, date, startTime, endTime) => {
  const waitlist = getWaitlistForSlot(roomId, date, startTime, endTime);
  return waitlist.length + 1;
};

const promoteFromWaitlist = (roomId, date, startTime, endTime) => {
  const waitlist = getWaitlistForSlot(roomId, date, startTime, endTime);
  
  if (waitlist.length === 0) {
    return null;
  }
  
  const nextReservation = waitlist[0];
  
  db.updateReservationStatus(nextReservation.id, 'confirmed');
  
  db.deleteWaitlistByReservationId(nextReservation.id);
  
  db.updateWaitlistPositions(roomId, date, startTime, endTime);
  
  logOperation(nextReservation.id, 'promoted', {
    from: 'waitlisted',
    to: 'confirmed',
    position: nextReservation.position
  });
  
  return nextReservation;
};

const createReservation = (data) => {
  const { roomId, userName, userPhone, date, startTime, endTime, peopleCount, purpose } = data;
  
  const errors = [];
  
  if (!roomId) errors.push('请选择房间');
  if (!userName || userName.trim() === '') errors.push('请输入姓名');
  if (!date) errors.push('请选择日期');
  if (!startTime) errors.push('请选择开始时间');
  if (!endTime) errors.push('请选择结束时间');
  if (!peopleCount || peopleCount < 1) errors.push('请输入有效人数');
  if (!purpose || purpose.trim() === '') errors.push('请输入用途');
  
  errors.push(...validateDate(date));
  errors.push(...validateTimeSlot(startTime, endTime));
  
  const room = getRoomById(roomId);
  if (!room) {
    errors.push('所选房间不存在');
  } else if (peopleCount > room.capacity) {
    errors.push(`人数超出房间容量（最大 ${room.capacity} 人）`);
  }
  
  if (errors.length > 0) {
    return { success: false, errors };
  }
  
  const conflicts = getConflictingReservations(roomId, date, startTime, endTime);
  
  const insertReservation = db.prepare(`
    INSERT INTO reservations (room_id, user_name, user_phone, date, start_time, end_time, people_count, purpose, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  if (conflicts.length > 0) {
    const position = getNextWaitlistPosition(roomId, date, startTime, endTime);
    
    const result = insertReservation.run(
      roomId, userName, userPhone, date, startTime, endTime, peopleCount, purpose, 'waitlisted'
    );
    
    const reservationId = result.lastInsertRowid;
    
    const insertWaitlist = db.prepare(`
      INSERT INTO waitlist (reservation_id, position)
      VALUES (?, ?)
    `);
    insertWaitlist.run(reservationId, position);
    
    logOperation(reservationId, 'created_waitlist', {
      roomId, date, startTime, endTime, peopleCount, purpose, position
    }, userName);
    
    return { 
      success: true, 
      data: { id: reservationId, status: 'waitlisted', position },
      message: `该时段已被预约，您已加入候补队列，当前位置：第 ${position} 位`
    };
  }
  
  const result = insertReservation.run(
    roomId, userName, userPhone, date, startTime, endTime, peopleCount, purpose, 'confirmed'
  );
  
  const reservationId = result.lastInsertRowid;
  
  logOperation(reservationId, 'created', {
    roomId, date, startTime, endTime, peopleCount, purpose
  }, userName);
  
  return { 
    success: true, 
    data: { id: reservationId, status: 'confirmed' },
    message: '预约成功！'
  };
};

const cancelReservation = (reservationId, operator = 'system') => {
  const reservation = db.getReservationById(reservationId);
  
  if (!reservation) {
    return { success: false, error: '预约不存在' };
  }
  
  if (reservation.status === 'cancelled') {
    return { success: false, error: '该预约已被取消' };
  }
  
  const wasConfirmed = reservation.status === 'confirmed';
  
  db.updateReservationStatus(reservationId, 'cancelled');
  
  if (reservation.status === 'waitlisted') {
    db.deleteWaitlistByReservationId(reservationId);
    db.updateWaitlistPositions(
      reservation.room_id, 
      reservation.date, 
      reservation.start_time, 
      reservation.end_time
    );
  }
  
  logOperation(reservationId, 'cancelled', {
    previousStatus: reservation.status,
    room: reservation.room_name,
    date: reservation.date,
    time: `${reservation.start_time}-${reservation.end_time}`
  }, operator);
  
  let promotedReservation = null;
  if (wasConfirmed) {
    promotedReservation = promoteFromWaitlist(
      reservation.room_id, 
      reservation.date, 
      reservation.start_time, 
      reservation.end_time
    );
  }
  
  return { 
    success: true, 
    message: promotedReservation 
      ? `预约已取消，候补用户 ${promotedReservation.user_name} 已自动递补成功` 
      : '预约已取消',
    promoted: promotedReservation
  };
};

const getReservations = (filters = {}) => {
  let query = `
    SELECT r.*, rm.name as room_name, rm.capacity as room_capacity,
           w.position as waitlist_position
    FROM reservations r
    JOIN rooms rm ON r.room_id = rm.id
    LEFT JOIN waitlist w ON r.id = w.reservation_id
    WHERE 1=1
  `;
  const params = [];
  
  if (filters.roomId) {
    query += ' AND r.room_id = ?';
    params.push(filters.roomId);
  }
  
  if (filters.date) {
    query += ' AND r.date = ?';
    params.push(filters.date);
  }
  
  if (filters.status) {
    query += ' AND r.status = ?';
    params.push(filters.status);
  }
  
  query += ' ORDER BY r.date ASC, r.start_time ASC, r.created_at ASC';
  
  return db.prepare(query).all(...params);
};

const getReservationById = (id) => {
  return db.prepare(`
    SELECT r.*, rm.name as room_name, rm.capacity as room_capacity,
           w.position as waitlist_position
    FROM reservations r
    JOIN rooms rm ON r.room_id = rm.id
    LEFT JOIN waitlist w ON r.id = w.reservation_id
    WHERE r.id = ?
  `).get(id);
};

const getRooms = () => {
  return db.prepare('SELECT * FROM rooms ORDER BY name').all();
};

const getStatistics = (startDate, endDate) => {
  const stats = {};
  
  stats.totalReservations = db.prepare(`
    SELECT COUNT(*) as count FROM reservations 
    WHERE date >= ? AND date <= ?
  `).get(startDate, endDate).count;
  
  stats.confirmedReservations = db.prepare(`
    SELECT COUNT(*) as count FROM reservations 
    WHERE date >= ? AND date <= ? AND status = 'confirmed'
  `).get(startDate, endDate).count;
  
  stats.cancelledReservations = db.prepare(`
    SELECT COUNT(*) as count FROM reservations 
    WHERE date >= ? AND date <= ? AND status = 'cancelled'
  `).get(startDate, endDate).count;
  
  stats.waitlistCount = db.prepare(`
    SELECT COUNT(*) as count FROM reservations 
    WHERE date >= ? AND date <= ? AND status = 'waitlisted'
  `).get(startDate, endDate).count;
  
  stats.popularRooms = db.prepare(`
    SELECT rm.id, rm.name, COUNT(r.id) as reservation_count
    FROM reservations r
    JOIN rooms rm ON r.room_id = rm.id
    WHERE r.date >= ? AND r.date <= ? AND r.status = 'confirmed'
    GROUP BY rm.id, rm.name
    ORDER BY reservation_count DESC
  `).all(startDate, endDate);
  
  stats.popularHours = db.prepare(`
    SELECT 
      strftime('%H', start_time) as hour,
      COUNT(*) as reservation_count
    FROM reservations
    WHERE date >= ? AND date <= ? AND status = 'confirmed'
    GROUP BY strftime('%H', start_time)
    ORDER BY reservation_count DESC
  `).all(startDate, endDate);
  
  return stats;
};

const exportToCSV = (startDate, endDate) => {
  const reservations = db.prepare(`
    SELECT 
      r.id,
      rm.name as room_name,
      r.user_name,
      r.user_phone,
      r.date,
      r.start_time,
      r.end_time,
      r.people_count,
      r.purpose,
      r.status,
      w.position as waitlist_position,
      r.created_at,
      r.updated_at
    FROM reservations r
    JOIN rooms rm ON r.room_id = rm.id
    LEFT JOIN waitlist w ON r.id = w.reservation_id
    WHERE r.date >= ? AND r.date <= ?
    ORDER BY r.date ASC, r.start_time ASC
  `).all(startDate, endDate);
  
  const headers = [
    '预约ID', '房间名称', '预约人', '联系电话', '日期',
    '开始时间', '结束时间', '人数', '用途', '状态',
    '候补位置', '创建时间', '更新时间'
  ];
  
  const statusMap = {
    'confirmed': '已确认',
    'waitlisted': '候补中',
    'cancelled': '已取消'
  };
  
  let csv = headers.join(',') + '\n';
  
  reservations.forEach(r => {
    const row = [
      r.id,
      `"${r.room_name}"`,
      `"${r.user_name}"`,
      r.user_phone ? `"${r.user_phone}"` : '',
      r.date,
      r.start_time,
      r.end_time,
      r.people_count,
      `"${r.purpose}"`,
      statusMap[r.status] || r.status,
      r.waitlist_position || '',
      r.created_at,
      r.updated_at
    ];
    csv += row.join(',') + '\n';
  });
  
  return csv;
};

module.exports = {
  createReservation,
  cancelReservation,
  getReservations,
  getReservationById,
  getRooms,
  getConflictingReservations,
  getStatistics,
  exportToCSV,
  validateTimeSlot,
  validateDate,
  timeToMinutes
};
