const express = require('express');
const router = express.Router();
const dataStore = require('../dataStore');

router.get('/', (req, res) => {
  const inspections = dataStore.getAllInspections();
  res.json({
    count: inspections.length,
    data: inspections
  });
});

router.get('/:id', (req, res) => {
  const inspection = dataStore.getInspectionById(req.params.id);
  if (!inspection) {
    return res.status(404).json({ error: '巡检记录不存在' });
  }
  res.json(inspection);
});

router.post('/', (req, res) => {
  try {
    const { body } = req;
    if (!body.team || !body.location) {
      return res.status(400).json({ error: '缺少必要字段: team, location' });
    }
    const inspection = dataStore.addInspection(body, body.operator);
    res.status(201).json(inspection);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/batch', (req, res) => {
  try {
    const { records, operator } = req.body;
    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'records 必须是数组' });
    }
    const results = dataStore.batchImport(records, operator);
    res.json(results);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const { body } = req;
  const updated = dataStore.updateInspection(req.params.id, body, body.operator, body.reason);
  if (!updated) {
    return res.status(404).json({ error: '巡检记录不存在' });
  }
  res.json(updated);
});

router.post('/:id/withdraw', (req, res) => {
  const { operator, reason } = req.body;
  const withdrawn = dataStore.withdrawInspection(req.params.id, operator, reason);
  if (!withdrawn) {
    return res.status(404).json({ error: '巡检记录不存在' });
  }
  res.json({ message: '记录已撤回', withdrawn });
});

module.exports = router;
