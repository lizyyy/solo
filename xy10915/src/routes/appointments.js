const express = require('express');
const router = express.Router();
const { AppointmentService } = require('../services/appointmentService');
const ExceptionService = require('../services/exceptionService');

router.post('/', async (req, res) => {
  try {
    const result = await AppointmentService.createAppointment(req.body, req.headers['x-user'] || 'api_user');
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      date: req.query.date,
      elder_id: req.query.elder_id
    };
    const result = await AppointmentService.getAllAppointments(filters);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await AppointmentService.getAppointmentById(req.params.id);
    if (!result) {
      res.status(404).json({ success: false, error: '预约不存在' });
    } else {
      res.json({ success: true, data: result });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const result = await AppointmentService.getStatusHistory(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { new_status, reason } = req.body;
    const result = await AppointmentService.updateStatus(
      req.params.id, 
      new_status, 
      reason,
      req.headers['x-user'] || 'api_user'
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id/manual', async (req, res) => {
  try {
    const result = await AppointmentService.manualOverride(
      req.params.id,
      req.body,
      req.headers['x-user'] || 'admin'
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/exceptions/all', async (req, res) => {
  try {
    const result = await ExceptionService.getAllExceptions();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/exceptions/:id', async (req, res) => {
  try {
    const result = await ExceptionService.getExceptionById(req.params.id);
    if (!result) {
      res.status(404).json({ success: false, error: '异常记录不存在' });
    } else {
      res.json({ success: true, data: result });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
