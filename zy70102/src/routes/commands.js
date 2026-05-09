const express = require('express');
const router = express.Router();
const { createCommand, getCommands, getCommandById } = require('../services/commandService');

router.post('/', (req, res) => {
  const { deviceId, action, source, operator, reason } = req.body;

  if (!deviceId || !action) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数：deviceId 和 action',
    });
  }

  const result = createCommand(deviceId, action, { source, operator, reason });
  if (result.success) {
    res.status(201).json(result);
  } else {
    res.status(400).json(result);
  }
});

router.get('/', (req, res) => {
  const filters = {
    deviceId: req.query.deviceId,
    status: req.query.status,
    startTime: req.query.startTime,
    limit: req.query.limit ? parseInt(req.query.limit) : undefined,
  };
  const commands = getCommands(filters);
  res.json({ success: true, data: commands });
});

router.get('/:id', (req, res) => {
  const command = getCommandById(req.params.id);
  if (!command) {
    return res.status(404).json({ success: false, error: '指令不存在' });
  }
  res.json({ success: true, data: command });
});

module.exports = router;
