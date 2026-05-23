const express = require('express');
const router = express.Router();
const appointmentService = require('../services/appointmentService');

router.post('/', (req, res, next) => {
  try {
    const result = appointmentService.createAppointment(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/', (req, res, next) => {
  try {
    const { date } = req.query;
    const result = appointmentService.getAppointmentList(date);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const result = appointmentService.getAppointmentById(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/lock', (req, res, next) => {
  try {
    const { station_id } = req.body;
    const result = appointmentService.lockAppointment(req.params.id, station_id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', (req, res, next) => {
  try {
    const result = appointmentService.cancelAppointment(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
