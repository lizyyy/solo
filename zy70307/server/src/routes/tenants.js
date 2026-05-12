const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const { loadData, saveData, generateId } = require('../utils/dataStore');

router.get('/', (req, res) => {
  const data = loadData();
  res.json({ success: true, data: data.tenants });
});

router.post('/', (req, res) => {
  const data = loadData();
  const tenant = {
    id: generateId(),
    ...req.body,
    createdAt: dayjs().toISOString(),
  };
  data.tenants.push(tenant);
  saveData(data);
  res.json({ success: true, data: tenant });
});

router.put('/:id', (req, res) => {
  const data = loadData();
  const index = data.tenants.findIndex(t => t.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: '租户不存在' });
  }
  data.tenants[index] = { ...data.tenants[index], ...req.body, updatedAt: dayjs().toISOString() };
  saveData(data);
  res.json({ success: true, data: data.tenants[index] });
});

router.delete('/:id', (req, res) => {
  const data = loadData();
  data.tenants = data.tenants.filter(t => t.id !== req.params.id);
  saveData(data);
  res.json({ success: true });
});

module.exports = router;
