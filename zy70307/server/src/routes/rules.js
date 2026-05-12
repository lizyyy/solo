const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const { loadData, saveData, generateId } = require('../utils/dataStore');

router.get('/', (req, res) => {
  const data = loadData();
  res.json({ success: true, data: data.rules });
});

router.post('/', (req, res) => {
  const data = loadData();
  const rule = {
    id: generateId(),
    ...req.body,
    status: 'DRAFT',
    createdAt: dayjs().toISOString(),
  };
  data.rules.push(rule);
  saveData(data);
  res.json({ success: true, data: rule });
});

router.put('/:id', (req, res) => {
  const data = loadData();
  const index = data.rules.findIndex(r => r.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: '规则不存在' });
  }
  if (data.rules[index].status === 'ACTIVE') {
    return res.status(400).json({ success: false, message: '已激活的规则不能修改，请先暂停或回滚' });
  }
  data.rules[index] = { ...data.rules[index], ...req.body, updatedAt: dayjs().toISOString() };
  saveData(data);
  res.json({ success: true, data: data.rules[index] });
});

router.delete('/:id', (req, res) => {
  const data = loadData();
  const rule = data.rules.find(r => r.id === req.params.id);
  if (rule && rule.status === 'ACTIVE') {
    return res.status(400).json({ success: false, message: '已激活的规则不能删除，请先暂停或回滚' });
  }
  data.rules = data.rules.filter(r => r.id !== req.params.id);
  saveData(data);
  res.json({ success: true });
});

module.exports = router;
