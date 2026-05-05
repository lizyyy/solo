const express = require('express');
const router = express.Router();
const dataModel = require('../models/dataModel');
const scheduleController = require('../controllers/scheduleController');

// 初始化数据文件
dataModel.initializeFiles();

// 导入示例数据
router.post('/import-sample', (req, res) => {
  try {
    const success = dataModel.importSampleData();
    if (success) {
      res.json({ success: true, message: '示例数据导入成功' });
    } else {
      res.status(500).json({ success: false, message: '导入失败' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取所有数据
router.get('/data', (req, res) => {
  try {
    const data = dataModel.getAllData();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取特定类型数据
router.get('/data/:type', (req, res) => {
  try {
    const { type } = req.params;
    const data = dataModel.readData(type);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新特定类型数据
router.put('/data/:type', (req, res) => {
  try {
    const { type } = req.params;
    const { data } = req.body;
    const success = dataModel.saveData(type, data);
    if (success) {
      res.json({ success: true, message: '数据保存成功' });
    } else {
      res.status(500).json({ success: false, message: '保存失败' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 生成今日排班
router.get('/schedule/today', (req, res) => {
  try {
    const schedule = scheduleController.generateTodaySchedule();
    res.json({ success: true, schedule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 保存排班
router.post('/schedule/save', (req, res) => {
  try {
    const { schedule } = req.body;
    const success = scheduleController.saveSchedule(schedule);
    if (success) {
      res.json({ success: true, message: '排班保存成功' });
    } else {
      res.status(500).json({ success: false, message: '保存失败' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取排班历史
router.get('/schedule/history', (req, res) => {
  try {
    const history = scheduleController.getScheduleHistory();
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 保存复核备注
router.post('/review', (req, res) => {
  try {
    const { facadeId, reviewData } = req.body;
    const success = scheduleController.saveReview(facadeId, reviewData);
    if (success) {
      res.json({ success: true, message: '复核备注保存成功' });
    } else {
      res.status(500).json({ success: false, message: '保存失败' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取复核备注
router.get('/review', (req, res) => {
  try {
    const { date } = req.query;
    const reviews = scheduleController.getReviews(date);
    res.json({ success: true, reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 导出 Markdown 开工单
router.post('/export/markdown', (req, res) => {
  try {
    const { scheduleData } = req.body;
    const markdown = scheduleController.exportMarkdownSchedule(scheduleData);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=开工单-${scheduleController.getTodayDate()}.md`);
    res.send(markdown);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 导出 JSON 审计明细
router.post('/export/json', (req, res) => {
  try {
    const { scheduleData } = req.body;
    const json = scheduleController.exportJsonAudit(scheduleData);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=审计明细-${scheduleController.getTodayDate()}.json`);
    res.send(json);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取今日日期
router.get('/today', (req, res) => {
  res.json({ date: scheduleController.getTodayDate() });
});

module.exports = router;
