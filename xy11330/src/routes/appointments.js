const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const Task = require('../models/Task');

router.get('/', async (req, res) => {
  try {
    const filters = {
      date: req.query.date,
      status: req.query.status,
      department: req.query.department
    };

    const appointments = await Appointment.findAll(filters);
    res.json({
      success: true,
      data: appointments,
      total: appointments.length
    });
  } catch (err) {
    console.error('查询预约单列表失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: '预约单不存在'
      });
    }
    res.json({
      success: true,
      data: appointment
    });
  } catch (err) {
    console.error('查询预约单详情失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      appointment_no,
      patient_name,
      patient_id,
      phone,
      department,
      exam_type,
      appointment_date,
      appointment_time,
      priority,
      notes
    } = req.body;
    
    if (!appointment_no || !patient_name || !appointment_date || !appointment_time) {
      return res.status(400).json({
        success: false,
        error: '预约单号、患者姓名、预约日期、预约时间不能为空'
      });
    }

    const existing = await Appointment.findByAppointmentNo(appointment_no);
    if (existing) {
      return res.status(400).json({
        success: false,
        error: '预约单号已存在'
      });
    }

    const appointment = await Appointment.create({
      appointment_no,
      patient_name,
      patient_id,
      phone,
      department,
      exam_type,
      appointment_date,
      appointment_time,
      priority,
      notes
    });

    const task = await Task.create(appointment.id, 'api');

    res.json({
      success: true,
      message: '创建预约单成功',
      data: { appointment, task }
    });
  } catch (err) {
    console.error('创建预约单失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: '状态不能为空'
      });
    }

    const result = await Appointment.updateStatus(req.params.id, status);
    res.json({
      success: true,
      message: '更新状态成功',
      data: result
    });
  } catch (err) {
    console.error('更新状态失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
