const express = require('express');
const router = express.Router();
const { getSystemReport } = require('../services/report');
const { runCompensation, listTasks, getTask, retryTask } = require('../services/compensation');
const { getRiskRecords } = require('../services/risk');

router.get('/dashboard', (req, res) => {
  const report = getSystemReport();
  res.json({ success: true, data: report });
});

router.post('/compensation/run', (req, res) => {
  const { limit = 10 } = req.body;
  const result = runCompensation(parseInt(limit));
  
  res.json({
    success: true,
    message: `已处理 ${result.processed} 个补偿任务`,
    data: result
  });
});

router.get('/compensation/tasks', (req, res) => {
  const { status, limit = 50 } = req.query;
  const tasks = listTasks(status || null, parseInt(limit));
  
  res.json({
    success: true,
    data: {
      total: tasks.length,
      tasks
    }
  });
});

router.get('/compensation/tasks/:taskId', (req, res) => {
  const task = getTask(req.params.taskId);
  if (!task) {
    return res.status(404).json({ success: false, message: '补偿任务不存在' });
  }
  res.json({ success: true, data: task });
});

router.post('/compensation/tasks/:taskId/retry', (req, res) => {
  const result = retryTask(req.params.taskId);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.get('/risks', (req, res) => {
  const { accountId, limit = 50 } = req.query;
  const records = getRiskRecords(accountId || null, parseInt(limit));
  
  res.json({
    success: true,
    data: {
      total: records.length,
      records
    }
  });
});

module.exports = router;
