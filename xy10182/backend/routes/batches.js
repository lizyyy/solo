const express = require('express');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { readJSON, writeJSON } = require('../utils/db');

const router = express.Router();

function calculateBatchStatus(batch) {
  const now = moment();
  const expiryDate = moment(batch.expiryDate);
  const daysToExpiry = expiryDate.diff(now, 'days');
  
  if (daysToExpiry <= 0) {
    return 'expired';
  } else if (daysToExpiry <= 30) {
    return 'expiring';
  } else if (batch.remainingQuantity <= 0) {
    return 'empty';
  } else if (batch.remainingQuantity <= 3) {
    return 'low_stock';
  }
  return 'in_stock';
}

function updateBatchStatuses() {
  const batches = readJSON('batches.json');
  let updated = false;
  
  batches.forEach(batch => {
    const newStatus = calculateBatchStatus(batch);
    if (batch.status !== newStatus) {
      batch.status = newStatus;
      batch.updatedAt = new Date().toISOString();
      updated = true;
    }
  });
  
  if (updated) {
    writeJSON('batches.json', batches);
  }
}

router.get('/', (req, res) => {
  updateBatchStatuses();
  const { keyword, reagentId, status, batchNo } = req.query;
  let batches = readJSON('batches.json');
  const reagents = readJSON('reagents.json');
  
  const reagentMap = new Map(reagents.map(r => [r.id, r]));
  
  batches = batches.map(b => ({
    ...b,
    reagent: reagentMap.get(b.reagentId)
  }));
  
  if (keyword) {
    batches = batches.filter(b => 
      (b.reagent && b.reagent.name.includes(keyword)) ||
      b.batchNo.includes(keyword) ||
      b.qrCode.includes(keyword)
    );
  }
  if (reagentId) {
    batches = batches.filter(b => b.reagentId === reagentId);
  }
  if (status) {
    batches = batches.filter(b => b.status === status);
  }
  if (batchNo) {
    batches = batches.filter(b => b.batchNo.includes(batchNo));
  }
  
  res.json({ success: true, data: batches });
});

router.get('/:id', (req, res) => {
  updateBatchStatuses();
  const batches = readJSON('batches.json');
  const reagents = readJSON('reagents.json');
  const batch = batches.find(b => b.id === req.params.id);
  
  if (!batch) {
    return res.status(404).json({ success: false, message: '批次不存在' });
  }
  
  const reagent = reagents.find(r => r.id === batch.reagentId);
  
  res.json({ success: true, data: { ...batch, reagent } });
});

router.get('/qr/:qrCode', (req, res) => {
  updateBatchStatuses();
  const batches = readJSON('batches.json');
  const reagents = readJSON('reagents.json');
  const batch = batches.find(b => b.qrCode === req.params.qrCode);
  
  if (!batch) {
    return res.status(404).json({ success: false, message: '未找到对应批次，请检查二维码' });
  }
  
  const reagent = reagents.find(r => r.id === batch.reagentId);
  
  res.json({ success: true, data: { ...batch, reagent } });
});

router.post('/', (req, res) => {
  const batches = readJSON('batches.json');
  const reagents = readJSON('reagents.json');
  const { reagentId, batchNo, manufacturer, productionDate, expiryDate, totalQuantity, storageLocation } = req.body;
  
  if (!reagentId || !batchNo || !totalQuantity) {
    return res.status(400).json({ success: false, message: '必填字段不能为空' });
  }
  
  if (!reagents.some(r => r.id === reagentId)) {
    return res.status(400).json({ success: false, message: '对应试剂不存在' });
  }
  
  if (batches.some(b => b.batchNo === batchNo)) {
    return res.status(400).json({ success: false, message: '批次号已存在' });
  }
  
  const qty = parseInt(totalQuantity);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ success: false, message: '入库数量必须为正整数' });
  }
  
  const newBatch = {
    id: uuidv4(),
    reagentId,
    batchNo,
    manufacturer: manufacturer || '',
    productionDate: productionDate || moment().format('YYYY-MM-DD'),
    expiryDate: expiryDate || moment().add(1, 'year').format('YYYY-MM-DD'),
    totalQuantity: qty,
    usedQuantity: 0,
    remainingQuantity: qty,
    status: 'in_stock',
    storageLocation: storageLocation || '',
    qrCode: `QR-${batchNo}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  newBatch.status = calculateBatchStatus(newBatch);
  
  batches.push(newBatch);
  writeJSON('batches.json', batches);
  
  res.status(201).json({ success: true, data: newBatch });
});

router.put('/:id', (req, res) => {
  const batches = readJSON('batches.json');
  const index = batches.findIndex(b => b.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: '批次不存在' });
  }
  
  const updated = {
    ...batches[index],
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  
  updated.status = calculateBatchStatus(updated);
  batches[index] = updated;
  writeJSON('batches.json', batches);
  
  res.json({ success: true, data: updated });
});

router.delete('/:id', (req, res) => {
  const batches = readJSON('batches.json');
  const records = readJSON('records.json');
  
  if (records.some(r => r.batchId === req.params.id)) {
    return res.status(400).json({ success: false, message: '该批次存在操作记录，无法删除' });
  }
  
  const index = batches.findIndex(b => b.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: '批次不存在' });
  }
  
  batches.splice(index, 1);
  writeJSON('batches.json', batches);
  
  res.json({ success: true, message: '删除成功' });
});

module.exports = router;
