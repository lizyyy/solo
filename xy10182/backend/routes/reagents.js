const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON } = require('../utils/db');

const router = express.Router();

router.get('/', (req, res) => {
  const { keyword, category, status } = req.query;
  let reagents = readJSON('reagents.json');
  
  if (keyword) {
    reagents = reagents.filter(r => 
      r.name.includes(keyword) || 
      r.code.includes(keyword)
    );
  }
  if (category) {
    reagents = reagents.filter(r => r.category === category);
  }
  if (status) {
    reagents = reagents.filter(r => r.status === status);
  }
  
  res.json({ success: true, data: reagents });
});

router.get('/:id', (req, res) => {
  const reagents = readJSON('reagents.json');
  const reagent = reagents.find(r => r.id === req.params.id);
  
  if (!reagent) {
    return res.status(404).json({ success: false, message: '试剂不存在' });
  }
  
  res.json({ success: true, data: reagent });
});

router.post('/', (req, res) => {
  const reagents = readJSON('reagents.json');
  const { name, code, category, specification, unit, minStock, maxStock, shelfLifeDays, description } = req.body;
  
  if (!name || !code || !category) {
    return res.status(400).json({ success: false, message: '必填字段不能为空' });
  }
  
  if (reagents.some(r => r.code === code)) {
    return res.status(400).json({ success: false, message: '试剂编码已存在' });
  }
  
  const newReagent = {
    id: uuidv4(),
    name,
    code,
    category,
    specification: specification || '',
    unit: unit || '瓶',
    minStock: minStock || 0,
    maxStock: maxStock || 100,
    shelfLifeDays: shelfLifeDays || 365,
    description: description || '',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  reagents.push(newReagent);
  writeJSON('reagents.json', reagents);
  
  res.status(201).json({ success: true, data: newReagent });
});

router.put('/:id', (req, res) => {
  const reagents = readJSON('reagents.json');
  const index = reagents.findIndex(r => r.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: '试剂不存在' });
  }
  
  const updated = {
    ...reagents[index],
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  
  reagents[index] = updated;
  writeJSON('reagents.json', reagents);
  
  res.json({ success: true, data: updated });
});

router.delete('/:id', (req, res) => {
  const reagents = readJSON('reagents.json');
  const batches = readJSON('batches.json');
  
  if (batches.some(b => b.reagentId === req.params.id)) {
    return res.status(400).json({ success: false, message: '该试剂存在批次库存，无法删除' });
  }
  
  const index = reagents.findIndex(r => r.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: '试剂不存在' });
  }
  
  reagents.splice(index, 1);
  writeJSON('reagents.json', reagents);
  
  res.json({ success: true, message: '删除成功' });
});

router.get('/categories/list', (req, res) => {
  const reagents = readJSON('reagents.json');
  const categories = [...new Set(reagents.map(r => r.category).filter(Boolean))];
  res.json({ success: true, data: categories });
});

module.exports = router;
