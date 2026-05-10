const express = require('express');
const router = express.Router();

const DeathLossModel = require('../models/deathLoss');
const BatchModel = require('../models/batch');
const OperationLogModel = require('../models/operationLog');
const AttributionService = require('../services/attributionService');

router.get('/', (req, res) => {
  const { batch_id, tank_id } = req.query;
  
  let records;
  
  if (batch_id) {
    records = DeathLossModel.getByBatchId(batch_id);
  } else if (tank_id) {
    records = DeathLossModel.getByTankId(tank_id);
  } else {
    records = DeathLossModel.getAll();
  }
  
  res.json({ success: true, data: records });
});

router.get('/:id', (req, res) => {
  const record = DeathLossModel.getById(req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, error: '死耗记录不存在' });
  }
  res.json({ success: true, data: record });
});

router.post('/', (req, res) => {
  const { batch_id, tank_id, quantity, discovered_at, reported_by, initial_cause } = req.body;
  
  if (!batch_id || !tank_id || !quantity) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数: batch_id, tank_id, quantity'
    });
  }
  
  const batch = BatchModel.getById(batch_id);
  if (!batch) {
    return res.status(404).json({ success: false, error: '批次不存在' });
  }
  
  if (batch.quantity < batch.death_quantity + parseInt(quantity)) {
    return res.status(400).json({
      success: false,
      error: '死耗数量超过批次剩余数量'
    });
  }
  
  const deathLoss = DeathLossModel.create({
    batch_id,
    tank_id,
    quantity: parseInt(quantity),
    discovered_at,
    reported_by: reported_by || res.locals.operator,
    initial_cause
  });
  
  BatchModel.addDeath(batch_id, parseInt(quantity));
  
  OperationLogModel.create({
    operation_type: OperationLogModel.OPERATION_TYPE.DEATH_LOSS_CREATE,
    target_type: 'batch',
    target_id: batch_id,
    operator: res.locals.operator,
    details: `记录死耗 - 批次: ${batch.batch_number}, 数量: ${quantity}`
  });
  
  res.json({ success: true, data: DeathLossModel.getById(deathLoss.id) });
});

router.get('/:id/analyze', (req, res) => {
  const result = AttributionService.analyzeDeathCause(req.params.id);
  
  if (!result.success) {
    return res.status(404).json(result);
  }
  
  res.json(result);
});

router.post('/:id/attribute', (req, res) => {
  const { final_cause, attribution_notes, attributed_to } = req.body;
  
  if (!final_cause) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数: final_cause'
    });
  }
  
  const deathLoss = DeathLossModel.getById(req.params.id);
  if (!deathLoss) {
    return res.status(404).json({ success: false, error: '死耗记录不存在' });
  }
  
  if (deathLoss.attribution_status === 'completed') {
    return res.status(400).json({
      success: false,
      error: '该记录已完成归因'
    });
  }
  
  const updated = DeathLossModel.attribute(req.params.id, {
    final_cause,
    attribution_notes,
    attributed_to,
    attributed_by: res.locals.operator
  });
  
  OperationLogModel.create({
    operation_type: OperationLogModel.OPERATION_TYPE.DEATH_LOSS_ATTRIBUTE,
    target_type: 'death_loss',
    target_id: req.params.id,
    operator: res.locals.operator,
    details: `死耗归因 - 原因: ${final_cause}${attribution_notes ? `, 备注: ${attribution_notes}` : ''}`
  });
  
  res.json({ success: true, data: updated });
});

module.exports = router;
