const express = require('express');
const router = express.Router();
const { DataService, ReplayService } = require('../services');

router.get('/', async (req, res) => {
  try {
    const result = await ReplayService.getAnomalyList(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:lossId', async (req, res) => {
  try {
    const result = await ReplayService.getLossDetail(req.params.lossId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:lossId/confirm', async (req, res) => {
  try {
    const { operator } = req.headers;
    if (!operator) return res.status(400).json({ success: false, error: '缺少操作人(operator)请求头' });
    
    const loss = await DataService.confirmLossRecord(req.params.lossId, operator);
    res.json({ success: true, data: loss });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:lossId/adjust', async (req, res) => {
  try {
    const { operator } = req.headers;
    if (!operator) return res.status(400).json({ success: false, error: '缺少操作人(operator)请求头' });
    
    const { data, reason } = req.body;
    const loss = await DataService.adjustLossRecord(req.params.lossId, data, operator, reason);
    res.json({ success: true, data: loss });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:lossId/versions', async (req, res) => {
  try {
    const result = await ReplayService.compareVersions(req.params.lossId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
