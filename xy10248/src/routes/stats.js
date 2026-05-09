const express = require('express');
const router = express.Router();
const db = require('../data/db');

router.get('/', (req, res) => {
  const { from, to } = req.query;
  const stats = db.getStatistics(from, to);
  res.json(stats);
});

router.get('/export', (req, res) => {
  const data = db.exportAllData();
  const filename = `laundry-export-${Date.now()}.json`;
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(JSON.stringify(data, null, 2));
});

router.post('/reset', (req, res) => {
  db.reset();
  res.json({ message: '数据已重置', timestamp: new Date().toISOString() });
});

module.exports = router;
