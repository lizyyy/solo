const express = require('express');
const router = express.Router();

const BatchModel = require('../models/batch');
const TankModel = require('../models/tank');
const OperationLogModel = require('../models/operationLog');

router.get('/', (req, res) => {
  const batches = BatchModel.getAll();
  res.json({ success: true, data: batches });
});

router.get('/:id', (req, res) => {
  const batch = BatchModel.getById(req.params.id);
  if (!batch) {
    return res.status(404).json({ success: false, error: '批次不存在' });
  }
  res.json({ success: true, data: batch });
});

router.post('/', (req, res) => {
  const { batch_number, species, quantity, entry_date, source, supplier, tank_id } = req.body;
  
  if (!batch_number || !species || !quantity || !entry_date) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数: batch_number, species, quantity, entry_date'
    });
  }
  
  try {
    const existing = BatchModel.getByBatchNumber(batch_number);
    if (existing) {
      return res.status(400).json({
        success: false,
        error: '批次号已存在'
      });
    }
    
    if (tank_id) {
      const tank = TankModel.getById(tank_id);
      if (!tank) {
        return res.status(400).json({
          success: false,
          error: '指定的暂养池不存在'
        });
      }
    }
    
    const batch = BatchModel.create({
      batch_number,
      species,
      quantity,
      entry_date,
      source,
      supplier,
      tank_id
    });
    
    if (tank_id) {
      BatchModel.bindToTank(batch.id, tank_id);
    }
    
    OperationLogModel.create({
      operation_type: OperationLogModel.OPERATION_TYPE.BATCH_CREATE,
      target_type: 'batch',
      target_id: batch.id,
      operator: res.locals.operator,
      details: `创建批次: ${batch_number}, 品种: ${species}, 数量: ${quantity}`
    });
    
    res.json({ success: true, data: BatchModel.getById(batch.id) });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/bind', (req, res) => {
  const { tank_id } = req.body;
  
  if (!tank_id) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数: tank_id'
    });
  }
  
  const batch = BatchModel.getById(req.params.id);
  if (!batch) {
    return res.status(404).json({ success: false, error: '批次不存在' });
  }
  
  const tank = TankModel.getById(tank_id);
  if (!tank) {
    return res.status(404).json({ success: false, error: '暂养池不存在' });
  }
  
  if (batch.status === 'completed') {
    return res.status(400).json({
      success: false,
      error: '已完成的批次无法重新绑定'
    });
  }
  
  const updatedBatch = BatchModel.bindToTank(req.params.id, tank_id);
  
  OperationLogModel.create({
    operation_type: OperationLogModel.OPERATION_TYPE.BATCH_BIND,
    target_type: 'batch',
    target_id: req.params.id,
    operator: res.locals.operator,
    details: `批次 ${batch.batch_number} 绑定到暂养池: ${tank.name}`
  });
  
  res.json({ success: true, data: updatedBatch });
});

router.put('/:id', (req, res) => {
  const batch = BatchModel.getById(req.params.id);
  if (!batch) {
    return res.status(404).json({ success: false, error: '批次不存在' });
  }
  
  const updates = {};
  const allowedFields = ['species', 'quantity', 'entry_date', 'source', 'supplier', 'notes'];
  
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }
  
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      success: false,
      error: '没有提供可更新的字段'
    });
  }
  
  const updatedBatch = BatchModel.update(req.params.id, updates);
  
  OperationLogModel.create({
    operation_type: OperationLogModel.OPERATION_TYPE.BATCH_UPDATE,
    target_type: 'batch',
    target_id: req.params.id,
    operator: res.locals.operator,
    details: `更新批次信息: ${JSON.stringify(updates)}`
  });
  
  res.json({ success: true, data: updatedBatch });
});

router.delete('/:id', (req, res) => {
  const batch = BatchModel.getById(req.params.id);
  if (!batch) {
    return res.status(404).json({ success: false, error: '批次不存在' });
  }
  
  if (batch.status === 'active') {
    return res.status(400).json({
      success: false,
      error: '活跃状态的批次无法删除，请先解绑或完成'
    });
  }
  
  const deleted = BatchModel.remove(req.params.id);
  
  if (deleted) {
    OperationLogModel.create({
      operation_type: OperationLogModel.OPERATION_TYPE.BATCH_DELETE,
      target_type: 'batch',
      target_id: req.params.id,
      operator: res.locals.operator,
      details: `删除批次: ${batch.batch_number}`
    });
  }
  
  res.json({ success: deleted });
});

module.exports = router;
