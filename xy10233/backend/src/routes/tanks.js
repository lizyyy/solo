const express = require('express');
const router = express.Router();

const TankModel = require('../models/tank');
const OperationLogModel = require('../models/operationLog');
const AttributionService = require('../services/attributionService');

router.get('/', (req, res) => {
  const tanks = TankModel.getAll();
  res.json({ success: true, data: tanks });
});

router.get('/:id', (req, res) => {
  const tank = TankModel.getById(req.params.id);
  if (!tank) {
    return res.status(404).json({ success: false, error: '暂养池不存在' });
  }
  res.json({ success: true, data: tank });
});

router.get('/:id/report', (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const result = AttributionService.getTrendReport(req.params.id, days);
  
  if (!result.success) {
    return res.status(404).json(result);
  }
  
  OperationLogModel.create({
    operation_type: OperationLogModel.OPERATION_TYPE.SYSTEM,
    target_type: 'tank',
    target_id: req.params.id,
    operator: res.locals.operator,
    details: `生成${days}天趋势报告`
  });
  
  res.json(result);
});

router.post('/', (req, res) => {
  const { name, capacity, species_type, thresholds } = req.body;
  
  if (!name || !capacity) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数: name, capacity'
    });
  }
  
  try {
    const existingTank = TankModel.getByName(name);
    if (existingTank) {
      return res.status(400).json({
        success: false,
        error: '暂养池名称已存在'
      });
    }
    
    const tankData = {
      name,
      capacity,
      species_type
    };
    
    if (thresholds) {
      Object.assign(tankData, {
        temperature_min: thresholds.temperature_min,
        temperature_max: thresholds.temperature_max,
        salinity_min: thresholds.salinity_min,
        salinity_max: thresholds.salinity_max,
        oxygen_min: thresholds.oxygen_min,
        oxygen_max: thresholds.oxygen_max
      });
    }
    
    const tank = TankModel.create(tankData);
    
    OperationLogModel.create({
      operation_type: OperationLogModel.OPERATION_TYPE.TANK_CREATE,
      target_type: 'tank',
      target_id: tank.id,
      operator: res.locals.operator,
      details: `创建暂养池: ${name}`
    });
    
    res.json({ success: true, data: tank });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/:id', (req, res) => {
  const tank = TankModel.getById(req.params.id);
  if (!tank) {
    return res.status(404).json({ success: false, error: '暂养池不存在' });
  }
  
  const updates = {};
  const allowedFields = ['name', 'capacity', 'species_type', 'status',
    'temperature_min', 'temperature_max',
    'salinity_min', 'salinity_max',
    'oxygen_min', 'oxygen_max'];
  
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
  
  const updatedTank = TankModel.update(req.params.id, updates);
  
  OperationLogModel.create({
    operation_type: OperationLogModel.OPERATION_TYPE.TANK_UPDATE,
    target_type: 'tank',
    target_id: req.params.id,
    operator: res.locals.operator,
    details: `更新暂养池配置: ${JSON.stringify(updates)}`
  });
  
  res.json({ success: true, data: updatedTank });
});

router.delete('/:id', (req, res) => {
  const tank = TankModel.getById(req.params.id);
  if (!tank) {
    return res.status(404).json({ success: false, error: '暂养池不存在' });
  }
  
  const deleted = TankModel.remove(req.params.id);
  
  if (deleted) {
    OperationLogModel.create({
      operation_type: OperationLogModel.OPERATION_TYPE.TANK_DELETE,
      target_type: 'tank',
      target_id: req.params.id,
      operator: res.locals.operator,
      details: `删除暂养池: ${tank.name}`
    });
  }
  
  res.json({ success: deleted });
});

module.exports = router;
