const express = require('express');
const router = express.Router();
const { getAllRules, getRuleById, getRuleExecutionLogs } = require('../services/interlockService');

router.get('/', (req, res) => {
  const onlyActive = req.query.active !== 'false';
  const rules = getAllRules(onlyActive);
  res.json({ success: true, data: rules });
});

router.get('/:id', (req, res) => {
  const rule = getRuleById(parseInt(req.params.id));
  if (!rule) {
    return res.status(404).json({ success: false, error: '规则不存在' });
  }
  res.json({ success: true, data: rule });
});

router.get('/logs/command/:commandId', (req, res) => {
  const logs = getRuleExecutionLogs({ commandId: req.params.commandId });
  res.json({ success: true, data: logs });
});

router.get('/logs/device/:deviceId', (req, res) => {
  const logs = getRuleExecutionLogs({ deviceId: req.params.deviceId });
  res.json({ success: true, data: logs });
});

module.exports = router;
