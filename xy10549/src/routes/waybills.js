const express = require('express');
const router = express.Router();
const { importWaybill } = require('../services/shipmentService');
const store = require('../data/store');

router.post('/import', (req, res) => {
  const { waybills, operator } = req.body;
  
  if (!waybills || !Array.isArray(waybills)) {
    return res.status(400).json({
      success: false,
      error: '缺少 waybills 数组'
    });
  }
  
  const results = waybills.map(wb => importWaybill(wb));
  
  const successCount = results.filter(r => r.success).length;
  const failedCount = results.length - successCount;
  
  res.json({
    success: true,
    total: waybills.length,
    successCount,
    failedCount,
    results
  });
});

router.get('/', (req, res) => {
  const waybills = store.getAllWaybills();
  res.json({
    success: true,
    data: waybills
  });
});

router.get('/:waybillId', (req, res) => {
  const waybill = store.getWaybill(req.params.waybillId);
  if (!waybill) {
    return res.status(404).json({
      success: false,
      error: '运单不存在'
    });
  }
  res.json({
    success: true,
    data: waybill
  });
});

module.exports = router;
