const express = require('express');
const router = express.Router();
const bookingService = require('../services/bookingService');
const { getStatusHistory, getManualCorrections } = require('../utils');

router.get('/', (req, res) => {
  try {
    const { status, customer_id, property_id } = req.query;
    const bookings = bookingService.listBookings(status, customer_id, property_id);
    res.json({ success: true, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const booking = bookingService.getBooking(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, error: '认购单不存在' });
    }
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/detail', (req, res) => {
  try {
    const detail = bookingService.getBookingDetail(req.params.id);
    if (!detail) {
      return res.status(404).json({ success: false, error: '认购单不存在' });
    }
    res.json({ success: true, data: detail });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/history', (req, res) => {
  try {
    const history = getStatusHistory('booking', req.params.id);
    const corrections = getManualCorrections('booking', req.params.id);
    res.json({ success: true, data: { history, manual_corrections: corrections } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const booking = bookingService.createBooking(req.body);
    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/lock', (req, res) => {
  try {
    const { operator } = req.body;
    const booking = bookingService.lockProperty(req.params.id, operator || 'system');
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/correct', (req, res) => {
  try {
    const { field_name, new_value, reason, operator } = req.body;
    const booking = bookingService.correctBooking(
      req.params.id, 
      field_name, 
      new_value, 
      reason, 
      operator || 'admin'
    );
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
