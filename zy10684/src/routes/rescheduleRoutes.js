const express = require('express');
const router = express.Router();
const rescheduleService = require('../services/rescheduleService');
const path = require('path');
const fs = require('fs');

router.post('/batches', (req, res) => {
  try {
    const result = rescheduleService.createRescheduleBatch(req.body);
    res.json({
      code: 0,
      message: '创建成功',
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      code: -1,
      message: error.message,
    });
  }
});

router.post('/batches/:batchId/submit', (req, res) => {
  try {
    const { operator } = req.body;
    const batch = rescheduleService.submitBatch(req.params.batchId, operator || 'system');
    res.json({
      code: 0,
      message: '提交成功',
      data: batch,
    });
  } catch (error) {
    res.status(400).json({
      code: -1,
      message: error.message,
    });
  }
});

router.post('/batches/:batchId/cancel', (req, res) => {
  try {
    const { operator } = req.body;
    const batch = rescheduleService.cancelBatch(req.params.batchId, operator || 'system');
    res.json({
      code: 0,
      message: '撤回成功',
      data: batch,
    });
  } catch (error) {
    res.status(400).json({
      code: -1,
      message: error.message,
    });
  }
});

router.post('/batches/:batchId/notify', (req, res) => {
  try {
    const { operator } = req.body;
    const result = rescheduleService.processNotifications(req.params.batchId, operator || 'system');
    res.json({
      code: 0,
      message: '通知成功',
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      code: -1,
      message: error.message,
    });
  }
});

router.post('/batches/:batchId/refund', (req, res) => {
  try {
    const { recordIds, operator } = req.body;
    if (!recordIds || !Array.isArray(recordIds)) {
      return res.status(400).json({
        code: -1,
        message: 'recordIds 必须是数组',
      });
    }
    const result = rescheduleService.processRefund(req.params.batchId, recordIds, operator || 'system');
    res.json({
      code: 0,
      message: '退款成功',
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      code: -1,
      message: error.message,
    });
  }
});

router.post('/batches/:batchId/reschedule', (req, res) => {
  try {
    const { recordIds, targetScheduleId, operator } = req.body;
    if (!recordIds || !Array.isArray(recordIds)) {
      return res.status(400).json({
        code: -1,
        message: 'recordIds 必须是数组',
      });
    }
    if (!targetScheduleId) {
      return res.status(400).json({
        code: -1,
        message: 'targetScheduleId 不能为空',
      });
    }
    const result = rescheduleService.processReschedule(req.params.batchId, recordIds, targetScheduleId, operator || 'system');
    res.json({
      code: 0,
      message: '改约成功',
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      code: -1,
      message: error.message,
    });
  }
});

router.post('/batches/:batchId/fail', (req, res) => {
  try {
    const { recordIds, errorMsg, operator } = req.body;
    if (!recordIds || !Array.isArray(recordIds)) {
      return res.status(400).json({
        code: -1,
        message: 'recordIds 必须是数组',
      });
    }
    const result = rescheduleService.markAsFailed(req.params.batchId, recordIds, errorMsg || '处理失败', operator || 'system');
    res.json({
      code: 0,
      message: '标记失败成功',
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      code: -1,
      message: error.message,
    });
  }
});

router.get('/batches', (req, res) => {
  try {
    const batches = rescheduleService.getBatchList(req.query);
    res.json({
      code: 0,
      message: '查询成功',
      data: batches,
    });
  } catch (error) {
    res.status(400).json({
      code: -1,
      message: error.message,
    });
  }
});

router.get('/batches/:batchId', (req, res) => {
  try {
    const detail = rescheduleService.getBatchDetail(req.params.batchId);
    res.json({
      code: 0,
      message: '查询成功',
      data: detail,
    });
  } catch (error) {
    res.status(400).json({
      code: -1,
      message: error.message,
    });
  }
});

router.get('/batches/:batchId/records', (req, res) => {
  try {
    const records = rescheduleService.getRecordsByBatch(req.params.batchId, req.query);
    res.json({
      code: 0,
      message: '查询成功',
      data: records,
    });
  } catch (error) {
    res.status(400).json({
      code: -1,
      message: error.message,
    });
  }
});

router.get('/history', (req, res) => {
  try {
    const { batchId } = req.query;
    const history = rescheduleService.getOperationHistory(batchId || null);
    res.json({
      code: 0,
      message: '查询成功',
      data: history,
    });
  } catch (error) {
    res.status(400).json({
      code: -1,
      message: error.message,
    });
  }
});

router.get('/batches/:batchId/export', async (req, res) => {
  try {
    const exportDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    const fileName = `reschedule_${req.params.batchId}_${Date.now()}.csv`;
    const filePath = path.join(exportDir, fileName);
    
    const result = await rescheduleService.exportBatchToCsv(req.params.batchId, filePath);
    
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('下载失败:', err);
      }
    });
  } catch (error) {
    res.status(400).json({
      code: -1,
      message: error.message,
    });
  }
});

router.get('/doctors', (req, res) => {
  const data = require('../models/data');
  res.json({
    code: 0,
    message: '查询成功',
    data: data.doctors,
  });
});

router.get('/schedules', (req, res) => {
  const data = require('../models/data');
  let schedules = [...data.schedules];
  if (req.query.doctorId) {
    schedules = schedules.filter(s => s.doctorId === req.query.doctorId);
  }
  res.json({
    code: 0,
    message: '查询成功',
    data: schedules,
  });
});

router.get('/patients', (req, res) => {
  const data = require('../models/data');
  res.json({
    code: 0,
    message: '查询成功',
    data: data.patients,
  });
});

module.exports = router;
