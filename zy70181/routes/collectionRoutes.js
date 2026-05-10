const express = require('express');
const router = express.Router();
const collectionService = require('../services/collectionService');

router.post('/tasks', (req, res) => {
  try {
    const result = collectionService.createCollectionTask(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/tasks', (req, res) => {
  const { status, customerId } = req.query;
  const tasks = collectionService.getCollectionTasks(
    status,
    customerId ? parseInt(customerId) : null
  );
  res.json({ success: true, data: tasks });
});

router.get('/tasks/block-points', (req, res) => {
  const tasks = collectionService.getTasksWithBlockPoints();
  res.json({ success: true, data: tasks });
});

router.get('/tasks/:id', (req, res) => {
  const detail = collectionService.getTaskDetail(parseInt(req.params.id));
  if (!detail) {
    return res.status(404).json({ success: false, error: '任务不存在' });
  }
  res.json({ success: true, data: detail });
});

router.post('/tasks/:id/advance', (req, res) => {
  try {
    const result = collectionService.advanceTask({
      taskId: parseInt(req.params.id),
      operator: req.body.operator,
      comment: req.body.comment
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/tasks/:id/reject', (req, res) => {
  try {
    const result = collectionService.rejectTask({
      taskId: parseInt(req.params.id),
      operator: req.body.operator,
      reason: req.body.reason
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/tasks/:id/restart', (req, res) => {
  try {
    const result = collectionService.restartTaskAfterReject({
      taskId: parseInt(req.params.id),
      operator: req.body.operator,
      comment: req.body.comment
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/promises', (req, res) => {
  try {
    const result = collectionService.recordPaymentPromise(req.body);
    res.json({ success: true, data: { promiseId: result.lastInsertRowid } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/promises', (req, res) => {
  const { taskId, customerId } = req.query;
  const promises = collectionService.getPaymentPromises(
    taskId ? parseInt(taskId) : null,
    customerId ? parseInt(customerId) : null
  );
  res.json({ success: true, data: promises });
});

router.post('/promises/:id/fulfill', (req, res) => {
  try {
    const result = collectionService.fulfillPromise(
      parseInt(req.params.id),
      req.body.actualDate
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/bad-debts', (req, res) => {
  try {
    const result = collectionService.markBadDebt(req.body);
    res.json({ success: true, data: { badDebtId: result.lastInsertRowid } });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/bad-debts', (req, res) => {
  const { status } = req.query;
  const badDebts = collectionService.getBadDebtRecords(status);
  res.json({ success: true, data: badDebts });
});

router.post('/bad-debts/:id/approve', (req, res) => {
  try {
    const result = collectionService.approveBadDebt(
      parseInt(req.params.id),
      req.body.operator
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
