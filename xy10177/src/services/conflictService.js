const db = require('../db');
const { timesOverlap, AppError } = require('../utils');
const { RESOURCE_TYPES } = require('./resourceService');

const BOOKING_STATUSES = {
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  PENDING: 'pending',
};

function checkResourceAvailability(resourceType, resourceId, startTime, endTime, excludeMeetingId = null) {
  if (!startTime || !endTime) {
    throw new AppError('Start time and end time are required', 400, 'MISSING_TIME_PARAMS');
  }

  const query = `
    SELECT b.*, m.title as meeting_title, m.organizer as meeting_organizer
    FROM bookings b
    JOIN meetings m ON b.meeting_id = m.id
    WHERE b.resource_type = ? 
      AND b.resource_id = ? 
      AND b.status = ?
      ${excludeMeetingId ? 'AND b.meeting_id != ?' : ''}
  `;

  const params = excludeMeetingId
    ? [resourceType, resourceId, BOOKING_STATUSES.ACTIVE, excludeMeetingId]
    : [resourceType, resourceId, BOOKING_STATUSES.ACTIVE];

  const bookings = db.prepare(query).all(...params);

  const conflicts = [];
  for (const booking of bookings) {
    if (timesOverlap(startTime, endTime, booking.start_time, booking.end_time)) {
      conflicts.push({
        booking_id: booking.id,
        meeting_id: booking.meeting_id,
        meeting_title: booking.meeting_title,
        meeting_organizer: booking.meeting_organizer,
        conflicting_time: {
          start: booking.start_time,
          end: booking.end_time,
        },
      });
    }
  }

  return {
    available: conflicts.length === 0,
    conflicts,
  };
}

function checkAllResourcesAvailability(roomId, deviceId, cateringId, startTime, endTime, excludeMeetingId = null) {
  const results = {
    room: { available: true, conflicts: [] },
    device: { available: true, conflicts: [] },
    catering: { available: true, conflicts: [] },
  };

  if (roomId) {
    results.room = checkResourceAvailability(RESOURCE_TYPES.ROOM, roomId, startTime, endTime, excludeMeetingId);
  }
  if (deviceId) {
    results.device = checkResourceAvailability(RESOURCE_TYPES.DEVICE, deviceId, startTime, endTime, excludeMeetingId);
  }
  if (cateringId) {
    results.catering = checkResourceAvailability(RESOURCE_TYPES.CATERING, cateringId, startTime, endTime, excludeMeetingId);
  }

  const allAvailable = results.room.available && results.device.available && results.catering.available;

  const allConflicts = [];
  if (!results.room.available) allConflicts.push(...results.room.conflicts.map(c => ({ ...c, resource_type: RESOURCE_TYPES.ROOM })));
  if (!results.device.available) allConflicts.push(...results.device.conflicts.map(c => ({ ...c, resource_type: RESOURCE_TYPES.DEVICE })));
  if (!results.catering.available) allConflicts.push(...results.catering.conflicts.map(c => ({ ...c, resource_type: RESOURCE_TYPES.CATERING })));

  return {
    available: allAvailable,
    details: results,
    conflicts: allConflicts,
  };
}

function checkRescheduleConflicts(meetingId, newRoomId, newDeviceId, newCateringId, newStartTime, newEndTime) {
  return checkAllResourcesAvailability(
    newRoomId,
    newDeviceId,
    newCateringId,
    newStartTime,
    newEndTime,
    meetingId
  );
}

function getMeetingBookings(meetingId) {
  return db.prepare(`
    SELECT * FROM bookings WHERE meeting_id = ? AND status = ? ORDER BY resource_type ASC
  `).all(meetingId, BOOKING_STATUSES.ACTIVE);
}

function findAlternativeResources(resourceType, startTime, endTime, currentResourceId = null) {
  let resourceQuery;
  let resourceJoin = '';

  switch (resourceType) {
    case RESOURCE_TYPES.ROOM:
      resourceQuery = 'SELECT id, name, capacity FROM meeting_rooms';
      break;
    case RESOURCE_TYPES.DEVICE:
      resourceQuery = 'SELECT id, name, type FROM devices';
      break;
    case RESOURCE_TYPES.CATERING:
      resourceQuery = 'SELECT id, name FROM catering';
      break;
    default:
      throw new AppError(`Invalid resource type: ${resourceType}`, 400, 'INVALID_RESOURCE_TYPE');
  }

  const resources = db.prepare(resourceQuery).all();

  const alternatives = [];
  for (const resource of resources) {
    if (currentResourceId && resource.id === currentResourceId) continue;

    const availability = checkResourceAvailability(resourceType, resource.id, startTime, endTime);
    if (availability.available) {
      alternatives.push({
        ...resource,
        resource_type: resourceType,
      });
    }
  }

  return alternatives;
}

function findAllAlternatives(roomId, deviceId, cateringId, startTime, endTime) {
  return {
    rooms: findAlternativeResources(RESOURCE_TYPES.ROOM, startTime, endTime, roomId),
    devices: findAlternativeResources(RESOURCE_TYPES.DEVICE, startTime, endTime, deviceId),
    caterings: findAlternativeResources(RESOURCE_TYPES.CATERING, startTime, endTime, cateringId),
  };
}

module.exports = {
  BOOKING_STATUSES,
  checkResourceAvailability,
  checkAllResourcesAvailability,
  checkRescheduleConflicts,
  getMeetingBookings,
  findAlternativeResources,
  findAllAlternatives,
};
