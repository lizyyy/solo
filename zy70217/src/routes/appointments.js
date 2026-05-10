const express = require('express');
const router = express.Router();
const appointmentService = require('../services/appointmentService');
const store = require('../models/store');
const AppError = require('../utils/errors');

router.post('/', (req, res) => {
  try {
    const result = appointmentService.createAppointment(req.body);
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message,
      statusCode: err.statusCode || 500
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const appointment = store.getAppointmentById(req.params.id);
    if (!appointment) {
      throw new AppError('预约不存在', 404);
    }
    
    const lock = store.getAppointmentLockByAppointmentId(req.params.id);
    res.json({
      success: true,
      data: {
        appointment,
        activeLock: lock || null
      }
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message,
      statusCode: err.statusCode || 500
    });
  }
});

router.post('/:id/cancel', (req, res) => {
  try {
    const result = appointmentService.cancelAppointment(req.params.id, req.body.reason);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message,
      statusCode: err.statusCode || 500
    });
  }
});

router.post('/:id/reschedule', (req, res) => {
  try {
    const result = appointmentService.rescheduleAppointment(
      req.params.id,
      req.body.newDate,
      req.body.newInventoryId
    );
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message,
      statusCode: err.statusCode || 500
    });
  }
});

router.post('/:id/complete', (req, res) => {
  try {
    const result = appointmentService.completeAppointment(req.params.id);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message,
      statusCode: err.statusCode || 500
    });
  }
});

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      appointments: store.store.appointments
    }
  });
});

module.exports = router;
