const express = require('express');
const router = express.Router();
const AppointmentService = require('../services/appointmentService');

router.post('/', async (req, res) => {
  try {
    const operator = {
      id: req.user?.id,
      name: req.user?.name || 'anonymous',
      ip: req.ip
    };
    
    const result = await AppointmentService.createAppointment(req.body, operator);
    
    if (result.success) {
      res.json({ success: true, id: result.id, message: '预约创建成功' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.get('/', async (req, res) => {
  try {
    const options = {
      status: req.query.status,
      visit_date: req.query.visit_date,
      visitor_phone: req.query.visitor_phone,
      plate_number: req.query.plate_number,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };
    
    const appointments = await AppointmentService.getAppointments(options);
    res.json({ success: true, data: appointments });
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const appointment = await AppointmentService.getAppointment(req.params.id);
    
    if (appointment) {
      res.json({ success: true, data: appointment });
    } else {
      res.status(404).json({ success: false, error: '预约不存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const operator = {
      id: req.user?.id,
      name: req.user?.name || 'anonymous'
    };
    
    const result = await AppointmentService.approveAppointment(req.params.id, operator);
    
    if (result.success) {
      res.json({ success: true, message: '审批通过' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

router.put('/:id/cancel', async (req, res) => {
  try {
    const operator = {
      id: req.user?.id,
      name: req.user?.name || 'anonymous'
    };
    
    const result = await AppointmentService.cancelAppointment(req.params.id, operator);
    
    if (result.success) {
      res.json({ success: true, message: '取消成功' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

module.exports = router;
