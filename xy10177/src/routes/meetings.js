const express = require('express');
const router = express.Router();
const { errorResponse, successResponse } = require('../utils');
const {
  createMeeting,
  getMeeting,
  getMeetingWithBookings,
  listMeetings,
} = require('../services/meetingService');
const {
  executeRescheduleTransaction,
  executeCancelTransaction,
  getHistory,
} = require('../services/transactionService');
const {
  checkAllResourcesAvailability,
  getMeetingBookings,
  findAllAlternatives,
} = require('../services/conflictService');
const {
  RESOURCE_TYPES,
} = require('../services/resourceService');
const {
  createBooking,
} = require('../services/meetingService');
const {
  generateMeetingICS,
  generateCalendarICS,
} = require('../services/calendarService');

router.get('/', (req, res) => {
  const { start_date, end_date, status } = req.query;
  const meetings = listMeetings(start_date, end_date, status);
  successResponse(res, { meetings });
});

router.post('/', (req, res) => {
  try {
    const { title, organizer, start_time, end_time } = req.body;
    const meeting = createMeeting(title, organizer, start_time, end_time);
    successResponse(res, { meeting });
  } catch (err) {
    errorResponse(res, err.statusCode || 500, err.message);
  }
});

router.post('/book', (req, res) => {
  try {
    const { title, organizer, start_time, end_time, room_id, device_id, catering_id } = req.body;

    const availability = checkAllResourcesAvailability(
      room_id, device_id, catering_id, start_time, end_time
    );

    if (!availability.available) {
      return res.status(409).json({
        success: false,
        error: 'RESOURCE_CONFLICT',
        conflicts: availability.conflicts,
      });
    }

    const meeting = createMeeting(title, organizer, start_time, end_time);

    if (room_id) {
      createBooking(meeting.id, RESOURCE_TYPES.ROOM, room_id, start_time, end_time);
    }
    if (device_id) {
      createBooking(meeting.id, RESOURCE_TYPES.DEVICE, device_id, start_time, end_time);
    }
    if (catering_id) {
      createBooking(meeting.id, RESOURCE_TYPES.CATERING, catering_id, start_time, end_time);
    }

    const meetingWithBookings = getMeetingWithBookings(meeting.id);
    
    successResponse(res, { meeting: meetingWithBookings });
  } catch (err) {
    errorResponse(res, err.statusCode || 500, err.message);
  }
});

router.get('/calendar', (req, res) => {
  const { start_date, end_date } = req.query;
  const ics = generateCalendarICS(start_date, end_date);
  
  if (!ics) {
    return successResponse(res, { message: 'No meetings found' });
  }

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=calendar.ics');
  res.send(ics);
});

router.get('/:id', (req, res) => {
  const meeting = getMeetingWithBookings(req.params.id);
  if (!meeting) {
    return errorResponse(res, 404, 'Meeting not found');
  }
  successResponse(res, { meeting });
});

router.get('/:id/bookings', (req, res) => {
  const meeting = getMeeting(req.params.id);
  if (!meeting) {
    return errorResponse(res, 404, 'Meeting not found');
  }
  const bookings = getMeetingBookings(req.params.id);
  successResponse(res, { bookings });
});

router.get('/:id/history', (req, res) => {
  const meeting = getMeeting(req.params.id);
  if (!meeting) {
    return errorResponse(res, 404, 'Meeting not found');
  }
  const history = getHistory(req.params.id, 50);
  
  const parsedHistory = history.map(h => ({
    ...h,
    old_values: h.old_values ? JSON.parse(h.old_values) : null,
    new_values: h.new_values ? JSON.parse(h.new_values) : null,
  }));
  
  successResponse(res, { history: parsedHistory });
});

router.get('/:id/check-reschedule', (req, res) => {
  try {
    const meeting = getMeeting(req.params.id);
    if (!meeting) {
      return errorResponse(res, 404, 'Meeting not found');
    }

    const { start_time, end_time, room_id, device_id, catering_id } = req.query;

    const currentBookings = getMeetingBookings(req.params.id);
    const oldRoomId = currentBookings.find(b => b.resource_type === RESOURCE_TYPES.ROOM)?.resource_id;
    const oldDeviceId = currentBookings.find(b => b.resource_type === RESOURCE_TYPES.DEVICE)?.resource_id;
    const oldCateringId = currentBookings.find(b => b.resource_type === RESOURCE_TYPES.CATERING)?.resource_id;

    const newStartTime = start_time || meeting.start_time;
    const newEndTime = end_time || meeting.end_time;
    const newRoomId = room_id !== undefined ? room_id : oldRoomId;
    const newDeviceId = device_id !== undefined ? device_id : oldDeviceId;
    const newCateringId = catering_id !== undefined ? catering_id : oldCateringId;

    const conflicts = checkAllResourcesAvailability(
      newRoomId,
      newDeviceId,
      newCateringId,
      newStartTime,
      newEndTime,
      req.params.id
    );

    const alternatives = findAllAlternatives(
      newRoomId,
      newDeviceId,
      newCateringId,
      newStartTime,
      newEndTime
    );

    successResponse(res, {
      available: conflicts.available,
      conflicts: conflicts.conflicts,
      alternatives,
    });
  } catch (err) {
    errorResponse(res, err.statusCode || 500, err.message);
  }
});

router.post('/:id/reschedule', (req, res) => {
  try {
    const { start_time, end_time, room_id, device_id, catering_id, actor, callback_url } = req.body;
    const result = executeRescheduleTransaction(
      req.params.id,
      {
        start_time,
        end_time,
        room_id,
        device_id,
        catering_id,
        callback_url,
      },
      actor || 'system'
    );

    if (result.success) {
      successResponse(res, result);
    } else {
      res.status(409).json(result);
    }
  } catch (err) {
    errorResponse(res, err.statusCode || 500, err.message);
  }
});

router.post('/:id/cancel', (req, res) => {
  try {
    const { actor, callback_url } = req.body;
    const result = executeCancelTransaction(
      req.params.id,
      actor || 'system',
      callback_url
    );
    successResponse(res, result);
  } catch (err) {
    errorResponse(res, err.statusCode || 500, err.message);
  }
});

router.get('/:id/calendar', (req, res) => {
  const ics = generateMeetingICS(req.params.id);
  
  if (!ics) {
    return errorResponse(res, 404, 'Meeting not found');
  }

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=meeting-${req.params.id}.ics`);
  res.send(ics);
});

module.exports = router;
