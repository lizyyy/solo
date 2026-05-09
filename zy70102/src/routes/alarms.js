const express = require('express');
const router = express.Router();
const { getAlarms, resolveAlarm, getAlarmById } = require('../services/alarmService');

router.get('/', (req, res) => {
  const filters = {
    resolved: req.query.resolved !== undefined ? req.query.resolved === 'true' : undefined,
    alarmType: req.query.alarmType,
    deviceId: req.query.deviceId,
    commandId: req.query.commandId,
    limit: req.query.limit ? parseInt(req.query.limit) : undefined,
  };
  const alarms = getAlarms(filters);
  res.json({ success: true, data: alarms });
});

router.get('/:id', (req, res) => {
  const alarm = getAlarmById(req.params.id);
  if (!alarm) {
    return res.status(404).json({ success: false, error: '报警不存在' });
  }
  res.json({ success: true, data: alarm });
});

router.post('/:id/resolve', (req, res) => {
  const { resolvedBy } = req.body;
  const success = resolveAlarm(req.params.id, resolvedBy);
  if (success) {
    res.json({ success: true, message: '报警已解除' });
  } else {
    res.status(404).json({ success: false, error: '报警不存在或已解除' });
  }
});

module.exports = router;
