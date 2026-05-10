const express = require('express');
const router = express.Router();

const WaterQualityModel = require('../models/waterQuality');
const TankModel = require('../models/tank');
const OperationLogModel = require('../models/operationLog');
const ThresholdService = require('../services/thresholdService');

router.get('/', (req, res) => {
  const { tank_id, start_time, end_time, limit } = req.query;
  
  let records;
  
  if (tank_id && start_time && end_time) {
    records = WaterQualityModel.getByTimeRange(tank_id, start_time, end_time);
  } else if (tank_id) {
    records = WaterQualityModel.getByTankId(tank_id, parseInt(limit) || 100);
  } else {
    records = WaterQualityModel.getAll();
  }
  
  res.json({ success: true, data: records });
});

router.get('/:id', (req, res) => {
  const record = WaterQualityModel.getById(req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, error: '水质记录不存在' });
  }
  res.json({ success: true, data: record });
});

router.post('/', (req, res) => {
  const { tank_id, temperature, salinity, oxygen, recorded_at, notes } = req.body;
  
  if (!tank_id || temperature === undefined || salinity === undefined || oxygen === undefined) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数: tank_id, temperature, salinity, oxygen'
    });
  }
  
  const tank = TankModel.getById(tank_id);
  if (!tank) {
    return res.status(404).json({ success: false, error: '暂养池不存在' });
  }
  
  const result = ThresholdService.importWaterQuality({
    tank_id,
    temperature: parseFloat(temperature),
    salinity: parseFloat(salinity),
    oxygen: parseFloat(oxygen),
    recorded_at,
    notes
  }, res.locals.operator);
  
  if (!result.success) {
    return res.status(400).json(result);
  }
  
  OperationLogModel.create({
    operation_type: OperationLogModel.OPERATION_TYPE.WATER_QUALITY_IMPORT,
    target_type: 'tank',
    target_id: tank_id,
    operator: res.locals.operator,
    details: `导入水质数据 - 温度:${temperature}, 盐度:${salinity}, 溶氧:${oxygen}`
  });
  
  res.json({
    success: true,
    data: result.waterQuality,
    checkResult: result.checkResult
  });
});

router.post('/bulk', (req, res) => {
  const { records } = req.body;
  
  if (!records || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({
      success: false,
      error: '缺少有效的记录数据'
    });
  }
  
  const result = ThresholdService.bulkImport(records, res.locals.operator);
  
  OperationLogModel.create({
    operation_type: OperationLogModel.OPERATION_TYPE.WATER_QUALITY_IMPORT,
    target_type: 'system',
    operator: res.locals.operator,
    details: `批量导入${records.length}条水质记录，成功${result.successCount}条，失败${result.failureCount}条`
  });
  
  res.json(result);
});

router.delete('/:id', (req, res) => {
  const record = WaterQualityModel.getById(req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, error: '水质记录不存在' });
  }
  
  const deleted = WaterQualityModel.remove(req.params.id);
  res.json({ success: deleted });
});

module.exports = router;
