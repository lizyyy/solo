const express = require('express');
const SchedulingEngine = require('../utils/schedulingEngine');
const FileManager = require('../utils/fileManager');

const router = express.Router();

router.post('/calculate', (req, res) => {
  try {
    const engine = new SchedulingEngine();
    engine.loadData();

    if (!engine.canCalculate()) {
      return res.status(400).json({
        success: false,
        error: '缺少必要数据',
        missing: {
          tide: !engine.tideData,
          berth: !engine.berthData,
          barge: !engine.bargeData
        }
      });
    }

    const schedule = engine.calculateSchedule();

    res.json({
      success: true,
      data: schedule
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '计算排程失败: ' + error.message
    });
  }
});

router.post('/validate', (req, res) => {
  try {
    const adjustedSchedule = req.body;

    if (!adjustedSchedule || !adjustedSchedule.barges) {
      return res.status(400).json({
        success: false,
        error: '排程数据格式不正确'
      });
    }

    const engine = new SchedulingEngine();
    engine.loadData();

    const validation = engine.validateAdjustedSchedule(adjustedSchedule);

    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '验证排程失败: ' + error.message
    });
  }
});

router.post('/save', (req, res) => {
  try {
    const scheduleData = req.body;

    if (!scheduleData) {
      return res.status(400).json({
        success: false,
        error: '缺少排程数据'
      });
    }

    const now = new Date().toISOString();
    const dataToSave = {
      ...scheduleData,
      createdAt: scheduleData.createdAt || now,
      updatedAt: now
    };

    const id = FileManager.saveSchedule(dataToSave);

    res.json({
      success: true,
      message: '排程已保存',
      data: { id }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '保存排程失败: ' + error.message
    });
  }
});

router.get('/list', (req, res) => {
  try {
    const schedules = FileManager.listSchedules();

    res.json({
      success: true,
      data: schedules
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取排程列表失败: ' + error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const schedule = FileManager.loadSchedule(id);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: '排程不存在'
      });
    }

    res.json({
      success: true,
      data: schedule
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '加载排程失败: ' + error.message
    });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = FileManager.deleteSchedule(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: '排程不存在'
      });
    }

    res.json({
      success: true,
      message: '排程已删除'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '删除排程失败: ' + error.message
    });
  }
});

router.post('/save-notes', (req, res) => {
  try {
    const { id, bargeId, notes } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: '缺少排程ID'
      });
    }

    const schedule = FileManager.loadSchedule(id);
    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: '排程不存在'
      });
    }

    if (!schedule.notes) {
      schedule.notes = {};
    }

    if (bargeId) {
      if (!schedule.bargeNotes) {
        schedule.bargeNotes = {};
      }
      schedule.bargeNotes[bargeId] = notes;
    } else {
      schedule.notes.general = notes;
    }

    schedule.updatedAt = new Date().toISOString();
    FileManager.saveSchedule(schedule);

    res.json({
      success: true,
      message: '备注已保存'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '保存备注失败: ' + error.message
    });
  }
});

module.exports = router;
