const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const moment = require('moment');
const { LostItem, STATUS_FLOW, lostItems, processedRequestIds } = require('../models/LostItem');

const checkIdempotency = (req, res, next) => {
  const requestId = req.headers['x-request-id'];
  if (requestId && processedRequestIds.has(requestId)) {
    return res.status(200).json({ message: '重复请求，已处理', isDuplicate: true });
  }
  if (requestId) {
    processedRequestIds.add(requestId);
  }
  next();
};

router.use(checkIdempotency);

router.post('/', (req, res) => {
  try {
    const item = new LostItem(req.body);
    item.addStatusHistory('REGISTERED', '遗失物信息登记完成', req.body.operator || 'system');
    item.addOperationLog('CREATE', '创建遗失物记录', req.body.operator || 'system');
    lostItems.push(item);
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', (req, res) => {
  let result = [...lostItems];
  const { handler, startDate, endDate, status } = req.query;
  
  if (handler) {
    result = result.filter(item => item.currentHandler.includes(handler));
  }
  if (startDate) {
    result = result.filter(item => new Date(item.updatedAt) >= new Date(startDate));
  }
  if (endDate) {
    result = result.filter(item => new Date(item.updatedAt) <= new Date(endDate));
  }
  if (status) {
    result = result.filter(item => item.status === status);
  }
  
  res.json(result);
});

router.get('/:id', (req, res) => {
  const item = lostItems.find(i => i.id === req.params.id);
  if (!item) {
    return res.status(404).json({ error: '记录不存在' });
  }
  res.json(item);
});

router.put('/:id/status', (req, res) => {
  const item = lostItems.find(i => i.id === req.params.id);
  if (!item) {
    return res.status(404).json({ error: '记录不存在' });
  }
  
  const { status, reason, operator, claimantInfo, disposalInfo } = req.body;
  
  if (!STATUS_FLOW[status]) {
    return res.status(400).json({ error: '无效的状态值' });
  }
  
  if (claimantInfo) {
    item.claimantInfo = claimantInfo;
  }
  if (disposalInfo) {
    item.disposalInfo = disposalInfo;
  }
  
  item.addStatusHistory(status, reason, operator || 'system');
  item.addOperationLog('STATUS_CHANGE', `状态变更为: ${STATUS_FLOW[status]}`, operator || 'system');
  
  res.json(item);
});

router.put('/:id/correct', (req, res) => {
  const item = lostItems.find(i => i.id === req.params.id);
  if (!item) {
    return res.status(404).json({ error: '记录不存在' });
  }
  
  const { photos, foundLocation, customerClues, operator, reason } = req.body;
  const oldValues = {};
  const newValues = {};
  
  if (photos !== undefined) {
    oldValues.photos = [...item.photos];
    newValues.photos = photos;
    item.photos = photos;
  }
  if (foundLocation !== undefined) {
    oldValues.foundLocation = item.foundLocation;
    newValues.foundLocation = foundLocation;
    item.foundLocation = foundLocation;
  }
  if (customerClues !== undefined) {
    oldValues.customerClues = item.customerClues;
    newValues.customerClues = customerClues;
    item.customerClues = customerClues;
  }
  
  item.addStatusHistory(item.status, reason || '信息修正', operator || 'system', oldValues, newValues);
  item.addOperationLog('CORRECT', '修正遗失物信息', operator || 'system');
  
  res.json(item);
});

router.post('/batch-import', (req, res) => {
  try {
    const { items, operator } = req.body;
    const imported = [];
    
    for (const itemData of items) {
      const item = new LostItem(itemData);
      item.addStatusHistory('REGISTERED', '批量导入遗失物登记', operator || 'system');
      item.addOperationLog('BATCH_IMPORT', '批量导入创建', operator || 'system');
      lostItems.push(item);
      imported.push(item);
    }
    
    res.status(201).json({ count: imported.length, items: imported });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/export/excel', (req, res) => {
  let result = [...lostItems];
  const { handler, startDate, endDate } = req.query;
  
  if (handler) {
    result = result.filter(item => item.currentHandler.includes(handler));
  }
  if (startDate) {
    result = result.filter(item => new Date(item.updatedAt) >= new Date(startDate));
  }
  if (endDate) {
    result = result.filter(item => new Date(item.updatedAt) <= new Date(endDate));
  }
  
  const exportData = result.map(item => ({
    '物品编号': item.id,
    '物品名称': item.itemName,
    '物品描述': item.itemDescription,
    '发现位置': item.foundLocation,
    '发现时间': moment(item.foundTime).format('YYYY-MM-DD HH:mm:ss'),
    '顾客线索': item.customerClues,
    '当前状态': STATUS_FLOW[item.status],
    '当前处理人': item.currentHandler,
    '保管到期日': moment(item.storageExpiryDate).format('YYYY-MM-DD'),
    '创建时间': moment(item.createdAt).format('YYYY-MM-DD HH:mm:ss'),
    '更新时间': moment(item.updatedAt).format('YYYY-MM-DD HH:mm:ss')
  }));
  
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportData);
  XLSX.utils.book_append_sheet(wb, ws, '遗失物记录');
  
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=遗失物记录_${moment().format('YYYYMMDDHHmmss')}.xlsx`);
  res.send(buffer);
});

router.get('/:id/timeline', (req, res) => {
  const item = lostItems.find(i => i.id === req.params.id);
  if (!item) {
    return res.status(404).json({ error: '记录不存在' });
  }
  
  const timeline = item.statusHistory.map(h => ({
    time: h.timestamp,
    status: STATUS_FLOW[h.status],
    statusCode: h.status,
    reason: h.reason,
    operator: h.operator,
    oldValues: h.oldValues,
    newValues: h.newValues,
    hasChanges: !!(h.oldValues || h.newValues)
  }));
  
  res.json(timeline.sort((a, b) => new Date(b.time) - new Date(a.time)));
});

module.exports = router;