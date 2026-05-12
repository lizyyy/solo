const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const { loadData, saveData, generateId } = require('../utils/dataStore');

router.get('/', (req, res) => {
  const data = loadData();
  res.json({ success: true, data: data.interfaceGroups });
});

router.post('/', (req, res) => {
  const data = loadData();
  const group = {
    id: generateId(),
    ...req.body,
    createdAt: dayjs().toISOString(),
  };
  data.interfaceGroups.push(group);
  saveData(data);
  res.json({ success: true, data: group });
});

router.put('/:id', (req, res) => {
  const data = loadData();
  const index = data.interfaceGroups.findIndex(g => g.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: '接口分组不存在' });
  }
  data.interfaceGroups[index] = { ...data.interfaceGroups[index], ...req.body, updatedAt: dayjs().toISOString() };
  saveData(data);
  res.json({ success: true, data: data.interfaceGroups[index] });
});

router.delete('/:id', (req, res) => {
  const data = loadData();
  data.interfaceGroups = data.interfaceGroups.filter(g => g.id !== req.params.id);
  saveData(data);
  res.json({ success: true });
});

module.exports = router;
