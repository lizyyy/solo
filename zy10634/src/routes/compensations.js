const express = require('express');
const router = express.Router();
const store = require('../store');
const exportService = require('../services/exportService');
const { STATUS_FLOW, REASSIGNMENT_TYPES } = require('../models/Compensation');

router.get('/meta', (req, res) => {
  res.json({
    statuses: Object.values(STATUS_FLOW),
    reassignmentTypes: Object.values(REASSIGNMENT_TYPES)
  });
});

router.post('/', (req, res) => {
  try {
    const { riderId, riderName, orderId, orderNo, reassignmentType, reason, compensationAmount, status, operator } = req.body;
    
    if (!riderId || !riderName || !orderId || !orderNo || !reassignmentType || !reason || compensationAmount === undefined) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    const compensation = store.create({
      riderId, riderName, orderId, orderNo, reassignmentType, reason, compensationAmount, status, operator
    });
    
    res.status(201).json(compensation.toJSON());
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/batch', (req, res) => {
  try {
    const { records } = req.body;
    const results = [];
    const errors = [];

    records.forEach((record, index) => {
      try {
        const { riderId, riderName, orderId, orderNo, reassignmentType, reason, compensationAmount, status } = record;
        
        if (!riderId || !orderId || !reassignmentType) {
          const errorComp = store.create({
            riderId: riderId || 'INVALID',
            riderName: riderName || '未知',
            orderId: orderId || `ERR-${index}`,
            orderNo: orderNo || `ERR-${index}`,
            reassignmentType: reassignmentType || '未知类型',
            reason: reason || '导入数据',
            compensationAmount: compensationAmount || 0,
            status: status || STATUS_FLOW.PENDING_DISPATCH,
            operator: 'import'
          });
          errorComp.markAsImportError(`第${index + 1}行数据不完整: 缺少必填字段`);
          results.push(errorComp.toJSON());
          errors.push({ row: index + 1, error: '缺少必填字段' });
          return;
        }

        const compensation = store.create({
          riderId, riderName, orderId, orderNo, reassignmentType, reason, compensationAmount, status, operator: 'import'
        });
        results.push(compensation.toJSON());
      } catch (error) {
        errors.push({ row: index + 1, error: error.message });
      }
    });

    res.json({
      success: results.length - errors.length,
      failed: errors.length,
      results,
      errors
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', (req, res) => {
  const { status, riderId, reassignmentType, conflict, importError } = req.query;
  const filters = {};
  if (status) filters.status = status;
  if (riderId) filters.riderId = riderId;
  if (reassignmentType) filters.reassignmentType = reassignmentType;
  if (conflict !== undefined) filters.conflict = conflict === 'true';
  if (importError !== undefined) filters.importError = importError === 'true';

  const compensations = store.findAll(filters);
  res.json({
    total: compensations.length,
    data: compensations.map(c => c.toJSON())
  });
});

router.get('/:id', (req, res) => {
  const compensation = store.findById(req.params.id);
  if (!compensation) {
    return res.status(404).json({ error: '补偿记录不存在' });
  }
  res.json(compensation.toJSON());
});

router.get('/:id/history', (req, res) => {
  const compensation = store.findById(req.params.id);
  if (!compensation) {
    return res.status(404).json({ error: '补偿记录不存在' });
  }
  res.json({
    compensationId: compensation.id,
    history: compensation.history
  });
});

router.put('/:id/status', (req, res) => {
  try {
    const { newStatus, reason, operator } = req.body;
    if (!newStatus) {
      return res.status(400).json({ error: '缺少新状态' });
    }
    const compensation = store.updateStatus(req.params.id, newStatus, reason, operator || 'api');
    res.json(compensation.toJSON());
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/export', async (req, res) => {
  try {
    const filters = req.body.filters || {};
    const compensations = store.findAll(filters);
    const result = await exportService.exportToCSV(compensations);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/list', (req, res) => {
  const files = exportService.listExports();
  res.json({ files });
});

router.get('/export/:filename', (req, res) => {
  const filepath = exportService.getExportFilePath(req.params.filename);
  res.download(filepath, (err) => {
    if (err) {
      res.status(404).json({ error: '文件不存在' });
    }
  });
});

router.delete('/:id', (req, res) => {
  const deleted = store.delete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: '补偿记录不存在' });
  }
  res.json({ success: true });
});

module.exports = router;
