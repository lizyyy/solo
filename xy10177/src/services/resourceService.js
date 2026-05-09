const db = require('../db');
const { generateId, now } = require('../utils');

const RESOURCE_TYPES = {
  ROOM: 'room',
  DEVICE: 'device',
  CATERING: 'catering',
};

const LOCK_TYPES = {
  SHARED: 'shared',
  EXCLUSIVE: 'exclusive',
  PENDING: 'pending',
};

const LOCK_STATUSES = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  RELEASED: 'released',
};

function createMeetingRoom(name, capacity, location = '') {
  const id = generateId();
  const stmt = db.prepare(`
    INSERT INTO meeting_rooms (id, name, capacity, location, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, name, capacity, location, now(), now());
  return getMeetingRoom(id);
}

function getMeetingRoom(id) {
  return db.prepare('SELECT * FROM meeting_rooms WHERE id = ?').get(id);
}

function listMeetingRooms() {
  return db.prepare('SELECT * FROM meeting_rooms ORDER BY created_at DESC').all();
}

function createDevice(name, type, roomId = null) {
  const id = generateId();
  const stmt = db.prepare(`
    INSERT INTO devices (id, name, type, room_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, name, type, roomId, now(), now());
  return getDevice(id);
}

function getDevice(id) {
  return db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
}

function listDevices() {
  return db.prepare('SELECT * FROM devices ORDER BY created_at DESC').all();
}

function createCatering(name, description = '') {
  const id = generateId();
  const stmt = db.prepare(`
    INSERT INTO catering (id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(id, name, description, now(), now());
  return getCatering(id);
}

function getCatering(id) {
  return db.prepare('SELECT * FROM catering WHERE id = ?').get(id);
}

function listCaterings() {
  return db.prepare('SELECT * FROM catering ORDER BY created_at DESC').all();
}

function getResource(resourceType, resourceId) {
  switch (resourceType) {
    case RESOURCE_TYPES.ROOM:
      return getMeetingRoom(resourceId);
    case RESOURCE_TYPES.DEVICE:
      return getDevice(resourceId);
    case RESOURCE_TYPES.CATERING:
      return getCatering(resourceId);
    default:
      return null;
  }
}

function isValidResourceType(type) {
  return Object.values(RESOURCE_TYPES).includes(type);
}

function isValidLockType(type) {
  return Object.values(LOCK_TYPES).includes(type);
}

module.exports = {
  RESOURCE_TYPES,
  LOCK_TYPES,
  LOCK_STATUSES,
  createMeetingRoom,
  getMeetingRoom,
  listMeetingRooms,
  createDevice,
  getDevice,
  listDevices,
  createCatering,
  getCatering,
  listCaterings,
  getResource,
  isValidResourceType,
  isValidLockType,
};
