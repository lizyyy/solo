const db = require('../db');
const { generateId, now, AppError } = require('../utils');
const { RESOURCE_TYPES } = require('./resourceService');
const { BOOKING_STATUSES } = require('./conflictService');

const MEETING_STATUSES = {
  SCHEDULED: 'scheduled',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
};

function createMeeting(title, organizer, startTime, endTime) {
  if (!title || !organizer || !startTime || !endTime) {
    throw new AppError('Missing required fields', 400, 'MISSING_FIELDS');
  }

  if (new Date(startTime.replace(' ', 'T')) >= new Date(endTime.replace(' ', 'T'))) {
    throw new AppError('End time must be after start time', 400, 'INVALID_TIME_RANGE');
  }

  const id = generateId();
  const stmt = db.prepare(`
    INSERT INTO meetings (id, title, organizer, start_time, end_time, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, title, organizer, startTime, endTime, MEETING_STATUSES.SCHEDULED, now(), now());
  
  return getMeeting(id);
}

function getMeeting(id) {
  return db.prepare('SELECT * FROM meetings WHERE id = ?').get(id);
}

function getMeetingWithBookings(id) {
  const meeting = getMeeting(id);
  if (!meeting) return null;

  const bookings = db.prepare(`
    SELECT * FROM bookings WHERE meeting_id = ? ORDER BY resource_type ASC
  `).all(id);

  return {
    ...meeting,
    bookings,
  };
}

function listMeetings(startDate = null, endDate = null, status = null) {
  let query = 'SELECT * FROM meetings WHERE 1=1';
  const params = [];

  if (startDate) {
    query += ' AND start_time >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND end_time <= ?';
    params.push(endDate);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY start_time ASC';
  return db.prepare(query).all(...params);
}

function updateMeeting(id, updates) {
  const meeting = getMeeting(id);
  if (!meeting) {
    throw new AppError(`Meeting not found: ${id}`, 404, 'MEETING_NOT_FOUND');
  }

  const allowedFields = ['title', 'organizer', 'start_time', 'end_time', 'status'];
  const validUpdates = {};
  
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      validUpdates[field] = updates[field];
    }
  }

  if (Object.keys(validUpdates).length === 0) {
    return meeting;
  }

  validUpdates.updated_at = now();

  const setClauses = Object.keys(validUpdates).map(field => `${field} = ?`);
  const values = [...Object.values(validUpdates), id];

  const stmt = db.prepare(`UPDATE meetings SET ${setClauses.join(', ')} WHERE id = ?`);
  stmt.run(...values);

  return getMeeting(id);
}

function cancelMeeting(id) {
  const meeting = getMeeting(id);
  if (!meeting) {
    throw new AppError(`Meeting not found: ${id}`, 404, 'MEETING_NOT_FOUND');
  }

  if (meeting.status === MEETING_STATUSES.CANCELLED) {
    throw new AppError('Meeting is already cancelled', 400, 'ALREADY_CANCELLED');
  }

  return updateMeeting(id, { status: MEETING_STATUSES.CANCELLED });
}

function createBooking(meetingId, resourceType, resourceId, startTime, endTime) {
  const id = generateId();
  const roomId = resourceType === RESOURCE_TYPES.ROOM ? resourceId : null;
  const deviceId = resourceType === RESOURCE_TYPES.DEVICE ? resourceId : null;
  const cateringId = resourceType === RESOURCE_TYPES.CATERING ? resourceId : null;

  const stmt = db.prepare(`
    INSERT INTO bookings (
      id, meeting_id, room_id, device_id, catering_id,
      resource_type, resource_id, start_time, end_time, status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id, meetingId, roomId, deviceId, cateringId,
    resourceType, resourceId, startTime, endTime, BOOKING_STATUSES.ACTIVE,
    now(), now()
  );

  return getBooking(id);
}

function getBooking(id) {
  return db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
}

function cancelBookingsByMeeting(meetingId) {
  const stmt = db.prepare(`
    UPDATE bookings SET status = ?, updated_at = ? WHERE meeting_id = ? AND status = ?
  `);
  const result = stmt.run(BOOKING_STATUSES.CANCELLED, now(), meetingId, BOOKING_STATUSES.ACTIVE);
  return result.changes;
}

function cancelBooking(id) {
  const booking = getBooking(id);
  if (!booking) {
    throw new AppError(`Booking not found: ${id}`, 404, 'BOOKING_NOT_FOUND');
  }

  const stmt = db.prepare(`
    UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?
  `);
  stmt.run(BOOKING_STATUSES.CANCELLED, now(), id);
  return getBooking(id);
}

module.exports = {
  MEETING_STATUSES,
  createMeeting,
  getMeeting,
  getMeetingWithBookings,
  listMeetings,
  updateMeeting,
  cancelMeeting,
  createBooking,
  getBooking,
  cancelBookingsByMeeting,
  cancelBooking,
};
