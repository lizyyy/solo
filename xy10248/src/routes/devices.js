const express = require('express');
const router = express.Router();
const db = require('../data/db');

router.post('/:deviceId/logs', (req, res) => {
  const { event, orderNo, details } = req.body;
  const log = db.addDeviceLog(req.params.deviceId, event, orderNo, details || {});
  res.status(201).json({ log });
});

router.get('/:deviceId/logs', (req, res) => {
  const { orderNo } = req.query;
  const logs = db.getDeviceLogs(req.params.deviceId, orderNo);
  res.json({ logs });
});

module.exports = router;
