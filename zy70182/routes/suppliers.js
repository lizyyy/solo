const express = require('express');
const router = express.Router();
const rebateRules = require('../modules/rebateRules');
const { getHistory } = require('../utils/audit');

router.get('/', (req, res) => {
  try {
    const suppliers = rebateRules.listSuppliers();
    res.json({
      success: true,
      data: suppliers
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
    const supplier = rebateRules.createSupplier(req.body, operator);
    
    res.json({
      success: true,
      data: supplier,
      message: '供应商创建成功'
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
    const supplier = rebateRules.getSupplier(req.params.id);
    
    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: '供应商不存在'
      });
    }
    
    res.json({
      success: true,
      data: supplier
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
    const history = getHistory('supplier', req.params.id);
    
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

module.exports = router;
