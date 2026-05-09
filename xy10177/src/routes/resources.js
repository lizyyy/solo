const express = require('express');
const router = express.Router();
const { errorResponse, successResponse } = require('../utils');
const {
  RESOURCE_TYPES,
  createMeetingRoom,
  getMeetingRoom,
  listMeetingRooms,
  createDevice,
  getDevice,
  listDevices,
  createCatering,
  getCatering,
  listCaterings,
} = require('../services/resourceService');
const {
  checkResourceAvailability,
} = require('../services/conflictService');

router.get('/rooms', (req, res) => {
  const rooms = listMeetingRooms();
  successResponse(res, { rooms });
});

router.get('/rooms/:id', (req, res) => {
  const room = getMeetingRoom(req.params.id);
  if (!room) {
    return errorResponse(res, 404, 'Room not found');
  }
  successResponse(res, { room });
});

router.post('/rooms', (req, res) => {
  try {
    const { name, capacity, location } = req.body;
    if (!name || !capacity) {
      return errorResponse(res, 400, 'Name and capacity are required');
    }
    const room = createMeetingRoom(name, capacity, location || '');
    successResponse(res, { room });
  } catch (err) {
    errorResponse(res, err.statusCode || 500, err.message);
  }
});

router.get('/rooms/:id/availability', (req, res) => {
  try {
    const { start_time, end_time } = req.query;
    if (!start_time || !end_time) {
      return errorResponse(res, 400, 'start_time and end_time are required');
    }
    const availability = checkResourceAvailability(
      RESOURCE_TYPES.ROOM,
      req.params.id,
      start_time,
      end_time
    );
    successResponse(res, { availability });
  } catch (err) {
    errorResponse(res, err.statusCode || 500, err.message);
  }
});

router.get('/devices', (req, res) => {
  const devices = listDevices();
  successResponse(res, { devices });
});

router.get('/devices/:id', (req, res) => {
  const device = getDevice(req.params.id);
  if (!device) {
    return errorResponse(res, 404, 'Device not found');
  }
  successResponse(res, { device });
});

router.post('/devices', (req, res) => {
  try {
    const { name, type, room_id } = req.body;
    if (!name || !type) {
      return errorResponse(res, 400, 'Name and type are required');
    }
    const device = createDevice(name, type, room_id || null);
    successResponse(res, { device });
  } catch (err) {
    errorResponse(res, err.statusCode || 500, err.message);
  }
});

router.get('/devices/:id/availability', (req, res) => {
  try {
    const { start_time, end_time } = req.query;
    if (!start_time || !end_time) {
      return errorResponse(res, 400, 'start_time and end_time are required');
    }
    const availability = checkResourceAvailability(
      RESOURCE_TYPES.DEVICE,
      req.params.id,
      start_time,
      end_time
    );
    successResponse(res, { availability });
  } catch (err) {
    errorResponse(res, err.statusCode || 500, err.message);
  }
});

router.get('/catering', (req, res) => {
  const caterings = listCaterings();
  successResponse(res, { caterings });
});

router.get('/catering/:id', (req, res) => {
  const catering = getCatering(req.params.id);
  if (!catering) {
    return errorResponse(res, 404, 'Catering not found');
  }
  successResponse(res, { catering });
});

router.post('/catering', (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return errorResponse(res, 400, 'Name is required');
    }
    const catering = createCatering(name, description || '');
    successResponse(res, { catering });
  } catch (err) {
    errorResponse(res, err.statusCode || 500, err.message);
  }
});

router.get('/catering/:id/availability', (req, res) => {
  try {
    const { start_time, end_time } = req.query;
    if (!start_time || !end_time) {
      return errorResponse(res, 400, 'start_time and end_time are required');
    }
    const availability = checkResourceAvailability(
      RESOURCE_TYPES.CATERING,
      req.params.id,
      start_time,
      end_time
    );
    successResponse(res, { availability });
  } catch (err) {
    errorResponse(res, err.statusCode || 500, err.message);
  }
});

module.exports = router;
