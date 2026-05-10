const express = require('express');
const router = express.Router();
const salesSummary = require('../modules/salesSummary');
const { getHistory } = require('../utils/audit');

router.get('/', (req, res) => {
  try {
    const { supplier_id, period } = req.query;
    const records = salesSummary.listSalesRecords(supplier_id, period);
    
    res.json({
      success: true,
      data: records
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'api';
    const record = salesSummary.addSalesRecord(req.body, operator);
    
    res.json({
      success: true,
      data: record,
      message: '销售记录添加成功'
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const record = salesSummary.getSalesRecord(req.params.id);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        error: '销售记录不存在'
      });
    }
    
    res.json({
      success: true,
      data: record
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/:id/history', (req, res) => {
  try {
    const history = getHistory('sales_record', req.params.id);
    
    res.json({
      success: true,
      data: history
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.get('/summary/:supplierId/:period', (req, res) => {
  try {
    const summary = salesSummary.getSalesSummary(req.params.supplierId, req.params.period);
    
    res.json({
      success: true,
      data: summary
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
