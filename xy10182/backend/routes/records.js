const express = require('express');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { readJSON, writeJSON } = require('../utils/db');

const router = express.Router();

const OPERATION_TYPES = {
  stock_in: '入库',
  open: '开封',
  claim: '领用',
  subpackage: '分装',
  return: '归还',
  discard: '报废'
};

function updateBatchQuantity(batchId, type, quantity) {
  const batches = readJSON('batches.json');
  const index = batches.findIndex(b => b.id === batchId);
  
  if (index === -1) {
    return { success: false, message: '批次不存在' };
  }
  
  const batch = batches[index];
  
  switch (type) {
    case 'claim':
    case 'subpackage':
    case 'discard':
      if (batch.remainingQuantity < quantity) {
        return { success: false, message: '库存不足，无法完成操作' };
      }
      batch.usedQuantity += quantity;
      batch.remainingQuantity -= quantity;
      break;
    case 'return':
      batch.usedQuantity = Math.max(0, batch.usedQuantity - quantity);
      batch.remainingQuantity += quantity;
      break;
    case 'stock_in':
    case 'open':
      batch.remainingQuantity = Math.max(0, batch.remainingQuantity - quantity);
      break;
  }
  
  batches[index] = batch;
  writeJSON('batches.json', batches);
  
  return { success: true, data: batch };
}

function validateOperation(batch, type, quantity) {
  if (batch.status === 'expired') {
    return { success: false, message: '该批次已过期，禁止领用/开封' };
  }
  
  if (batch.remainingQuantity <= 0 && type !== 'return') {
    return { success: false, message: '库存不足' };
  }
  
  if (quantity <= 0) {
    return { success: false, message: '操作数量必须大于0' };
  }
  
  if (['claim', 'subpackage', 'discard'].includes(type) && batch.remainingQuantity < quantity) {
    return { success: false, message: `操作数量(${quantity})大于剩余库存(${batch.remainingQuantity})` };
  }
  
  return { success: true };
}

router.get('/', (req, res) => {
  const { batchId, reagentId, type, operator, keyword, startDate, endDate } = req.query;
  let records = readJSON('records.json');
  const batches = readJSON('batches.json');
  const reagents = readJSON('reagents.json');
  
  const batchMap = new Map(batches.map(b => [b.id, b]));
  const reagentMap = new Map(reagents.map(r => [r.id, r]));
  
  records = records.map(r => ({
    ...r,
    typeLabel: OPERATION_TYPES[r.type] || r.type,
    batch: batchMap.get(r.batchId),
    reagent: reagentMap.get(r.reagentId)
  }));
  
  if (batchId) {
    records = records.filter(r => r.batchId === batchId);
  }
  if (reagentId) {
    records = records.filter(r => r.reagentId === reagentId);
  }
  if (type) {
    records = records.filter(r => r.type === type);
  }
  if (operator) {
    records = records.filter(r => r.operator.includes(operator));
  }
  if (keyword) {
    records = records.filter(r => 
      (r.reagent && r.reagent.name.includes(keyword)) ||
      (r.batch && r.batch.batchNo.includes(keyword)) ||
      r.operator.includes(keyword)
    );
  }
  if (startDate) {
    records = records.filter(r => moment(r.createdAt).isSameOrAfter(moment(startDate).startOf('day')));
  }
  if (endDate) {
    records = records.filter(r => moment(r.createdAt).isSameOrBefore(moment(endDate).endOf('day')));
  }
  
  records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json({ success: true, data: records });
});

router.get('/:id', (req, res) => {
  const records = readJSON('records.json');
  const batches = readJSON('batches.json');
  const reagents = readJSON('reagents.json');
  
  const record = records.find(r => r.id === req.params.id);
  
  if (!record) {
    return res.status(404).json({ success: false, message: '记录不存在' });
  }
  
  const batch = batches.find(b => b.id === record.batchId);
  const reagent = reagents.find(r => r.id === record.reagentId);
  
  res.json({ 
    success: true, 
    data: {
      ...record,
      typeLabel: OPERATION_TYPES[record.type] || record.type,
      batch,
      reagent
    }
  });
});

router.post('/scan', (req, res) => {
  const batches = readJSON('batches.json');
  const reagents = readJSON('reagents.json');
  const { scanCode, type, quantity, operator, operatorId, location, remark } = req.body;
  
  if (!scanCode) {
    return res.status(400).json({ success: false, message: '请扫描二维码' });
  }
  
  if (!OPERATION_TYPES[type]) {
    return res.status(400).json({ success: false, message: '无效的操作类型' });
  }
  
  const batch = batches.find(b => b.qrCode === scanCode);
  if (!batch) {
    return res.status(404).json({ success: false, message: '未找到对应批次，请检查二维码' });
  }
  
  const reagent = reagents.find(r => r.id === batch.reagentId);
  
  const qty = parseInt(quantity) || 1;
  
  const validation = validateOperation(batch, type, qty);
  if (!validation.success) {
    return res.status(400).json(validation);
  }
  
  const updateResult = updateBatchQuantity(batch.id, type, qty);
  if (!updateResult.success) {
    return res.status(400).json(updateResult);
  }
  
  const records = readJSON('records.json');
  const newRecord = {
    id: uuidv4(),
    batchId: batch.id,
    reagentId: batch.reagentId,
    type,
    quantity: qty,
    operator: operator || '未知操作员',
    operatorId: operatorId || 'unknown',
    location: location || '未指定',
    remark: remark || '',
    scanCode,
    createdAt: new Date().toISOString()
  };
  
  records.unshift(newRecord);
  writeJSON('records.json', records);
  
  res.status(201).json({ 
    success: true, 
    message: `${OPERATION_TYPES[type]}成功`,
    data: {
      record: newRecord,
      batch: updateResult.data,
      reagent
    }
  });
});

router.post('/', (req, res) => {
  const batches = readJSON('batches.json');
  const { batchId, type, quantity, operator, operatorId, location, remark } = req.body;
  
  if (!batchId || !type) {
    return res.status(400).json({ success: false, message: '必填字段不能为空' });
  }
  
  if (!OPERATION_TYPES[type]) {
    return res.status(400).json({ success: false, message: '无效的操作类型' });
  }
  
  const batch = batches.find(b => b.id === batchId);
  if (!batch) {
    return res.status(404).json({ success: false, message: '批次不存在' });
  }
  
  const qty = parseInt(quantity) || 1;
  
  const validation = validateOperation(batch, type, qty);
  if (!validation.success) {
    return res.status(400).json(validation);
  }
  
  const updateResult = updateBatchQuantity(batch.id, type, qty);
  if (!updateResult.success) {
    return res.status(400).json(updateResult);
  }
  
  const records = readJSON('records.json');
  const newRecord = {
    id: uuidv4(),
    batchId,
    reagentId: batch.reagentId,
    type,
    quantity: qty,
    operator: operator || '未知操作员',
    operatorId: operatorId || 'unknown',
    location: location || '未指定',
    remark: remark || '',
    scanCode: batch.qrCode,
    createdAt: new Date().toISOString()
  };
  
  records.unshift(newRecord);
  writeJSON('records.json', records);
  
  res.status(201).json({ 
    success: true, 
    message: `${OPERATION_TYPES[type]}成功`,
    data: newRecord
  });
});

router.get('/batch/:batchId/history', (req, res) => {
  const records = readJSON('records.json');
  const batches = readJSON('batches.json');
  const reagents = readJSON('reagents.json');
  
  const batch = batches.find(b => b.id === req.params.batchId);
  if (!batch) {
    return res.status(404).json({ success: false, message: '批次不存在' });
  }
  
  const reagent = reagents.find(r => r.id === batch.reagentId);
  
  const batchRecords = records
    .filter(r => r.batchId === req.params.batchId)
    .map(r => ({
      ...r,
      typeLabel: OPERATION_TYPES[r.type] || r.type
    }))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  
  const timeline = batchRecords.map((r, index) => ({
    ...r,
    sequence: index + 1
  }));
  
  res.json({ 
    success: true, 
    data: {
      batch: { ...batch, reagent },
      timeline
    }
  });
});

module.exports = router;
