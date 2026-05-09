const express = require('express');
const router = express.Router();
const { getDb } = require('../database/connection');

router.get('/', (req, res) => {
  const db = getDb();
  const devices = db.prepare('SELECT * FROM pump_devices ORDER BY id').all();
  res.json({ success: true, data: devices });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const device = db.prepare('SELECT * FROM pump_devices WHERE id = ?').get(req.params.id);
  if (!device) {
    return res.status(404).json({ success: false, error: '设备不存在' });
  }
  res.json({ success: true, data: device });
});

router.get('/:id/status', (req, res) => {
  const db = getDb();
  const device = db.prepare('SELECT id, name, current_status, updated_at FROM pump_devices WHERE id = ?').get(req.params.id);
  if (!device) {
    return res.status(404).json({ success: false, error: '设备不存在' });
  }
  res.json({ success: true, data: device });
});

module.exports = router;
