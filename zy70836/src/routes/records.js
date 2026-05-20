const express = require('express');
const router = express.Router();
const batchService = require('../services/batchService');
const queryService = require('../services/queryService');

router.post('/return/:id', async (req, res) => {
  try {
    const { operator, actual_return_time, end_mileage, end_fuel_balance, remark } = req.body;
    if (!operator || !actual_return_time || end_mileage === undefined) {
      return res.status(400).json({ error: '操作人、还车时间、结束里程不能为空' });
    }
    await batchService.processReturn(req.params.id, req.body, operator);
    res.json({ success: true, message: '还车处理完成' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/violation/:id/handle', async (req, res) => {
  try {
    const { attribution_result, handler, remark } = req.body;
    if (!attribution_result || !handler) {
      return res.status(400).json({ error: '归属结果和处理人不能为空' });
    }
    await batchService.handleViolation(req.params.id, attribution_result, handler, remark);
    res.json({ success: true, message: '违章处理完成' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;