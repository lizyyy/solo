const express = require('express');
const router = express.Router();
const Escort = require('../models/Escort');

router.get('/', async (req, res) => {
  try {
    const escorts = await Escort.findAll(req.query.status);
    res.json({
      success: true,
      data: escorts,
      total: escorts.length
    });
  } catch (err) {
    console.error('查询陪检员列表失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/available', async (req, res) => {
  try {
    const { date, time } = req.query;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        error: '日期不能为空'
      });
    }

    const escorts = await Escort.getAvailableEscorts(date, time);
    res.json({
      success: true,
      data: escorts,
      total: escorts.length
    });
  } catch (err) {
    console.error('查询可用陪检员失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const escort = await Escort.findById(req.params.id);
    if (!escort) {
      return res.status(404).json({
        success: false,
        error: '陪检员不存在'
      });
    }
    res.json({
      success: true,
      data: escort
    });
  } catch (err) {
    console.error('查询陪检员详情失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/:id/schedules', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const schedules = await Escort.getSchedules(req.params.id, start_date, end_date);
    res.json({
      success: true,
      data: schedules
    });
  } catch (err) {
    console.error('查询陪检员班表失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { employee_id, name, phone, department } = req.body;
    
    if (!employee_id || !name) {
      return res.status(400).json({
        success: false,
        error: '员工工号和姓名不能为空'
      });
    }

    const existing = await Escort.findByEmployeeId(employee_id);
    if (existing) {
      return res.status(400).json({
        success: false,
        error: '员工工号已存在'
      });
    }

    const result = await Escort.create({ employee_id, name, phone, department });
    res.json({
      success: true,
      message: '创建陪检员成功',
      data: result
    });
  } catch (err) {
    console.error('创建陪检员失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/:id/schedules', async (req, res) => {
  try {
    const { date, shift_type, start_time, end_time } = req.body;
    
    if (!date || !shift_type) {
      return res.status(400).json({
        success: false,
        error: '日期和班次类型不能为空'
      });
    }

    const result = await Escort.addSchedule(req.params.id, date, shift_type, start_time, end_time);
    res.json({
      success: true,
      message: '添加班表成功',
      data: result
    });
  } catch (err) {
    console.error('添加班表失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
