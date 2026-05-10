const express = require('express');
const router = express.Router();
const consumptionService = require('../services/consumptionService');

router.get('/departments', (req, res) => {
  try {
    const departments = consumptionService.getDepartments();
    res.json({ success: true, data: departments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/records', (req, res) => {
  try {
    const { departmentId, materialId, treatmentId, startDate, endDate, limit } = req.query;
    const records = consumptionService.getConsumptionRecords({
      departmentId, materialId, treatmentId, startDate, endDate,
      limit: limit ? parseInt(limit) : undefined
    });
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stats', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const stats = consumptionService.getConsumptionStats(days);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/by-treatment', (req, res) => {
  try {
    const { departmentId, treatmentId, patientName, operator, quantity } = req.body;
    
    if (!departmentId || !treatmentId || !operator) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必填参数: departmentId, treatmentId, operator' 
      });
    }
    
    const result = consumptionService.consumeByTreatment({
      departmentId: parseInt(departmentId),
      treatmentId: parseInt(treatmentId),
      patientName,
      operator,
      quantity: parseInt(quantity) || 1
    });
    
    res.status(201).json({ 
      success: true, 
      data: result,
      message: `成功记录 ${result.length} 条耗材消耗`
    });
  } catch (error) {
    const statusCode = error.message.includes('库存不足') ? 409 : 400;
    res.status(statusCode).json({ 
      success: false, 
      error: error.message,
      details: error.cause
    });
  }
});

router.post('/manual', (req, res) => {
  try {
    const { departmentId, materialId, quantity, operator, notes, patientName } = req.body;
    
    if (!departmentId || !materialId || !quantity || !operator) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必填参数: departmentId, materialId, quantity, operator' 
      });
    }
    
    const result = consumptionService.consumeByManual({
      departmentId: parseInt(departmentId),
      materialId: parseInt(materialId),
      quantity: parseInt(quantity),
      operator,
      notes,
      patientName
    });
    
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.message.includes('库存不足') ? 409 : 400;
    res.status(statusCode).json({ success: false, error: error.message });
  }
});

module.exports = router;
