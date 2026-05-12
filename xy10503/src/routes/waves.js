const express = require('express');
const router = express.Router();
const core = require('../services/core');

router.post('/', (req, res) => {
  try {
    const idempotentKey = req.headers['x-idempotent-key'];
    const operator = req.headers['x-operator'] || 'system';

    if (idempotentKey) {
      const result = core.withIdempotency(idempotentKey, () => {
        return core.createWave({ ...req.body, created_by: operator });
      });
      return res.json({
        success: true,
        is_idempotent: result.isIdempotent,
        data: result.data
      });
    }

    const wave = core.createWave({ ...req.body, created_by: operator });
    res.json({ success: true, data: wave });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/', (req, res) => {
  try {
    const waves = core.listWaves(req.query);
    res.json({ success: true, data: waves });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/no/:waveNo', (req, res) => {
  try {
    const wave = core.getWaveByNo(req.params.waveNo);
    if (!wave) {
      return res.status(404).json({ success: false, error: '波次不存在' });
    }
    res.json({ success: true, data: wave });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/:waveId', (req, res) => {
  try {
    const wave = core.getWaveById(req.params.waveId);
    if (!wave) {
      return res.status(404).json({ success: false, error: '波次不存在' });
    }
    res.json({ success: true, data: wave });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:waveId/orders', (req, res) => {
  try {
    const { order_nos } = req.body;
    const operator = req.headers['x-operator'] || 'system';

    if (!order_nos || !Array.isArray(order_nos) || order_nos.length === 0) {
      return res.status(400).json({ success: false, error: 'order_nos 必须是非空数组' });
    }

    const wave = core.addOrdersToWave(req.params.waveId, order_nos, operator);
    res.json({ success: true, data: wave });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:waveId/start-picking', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const wave = core.startPicking(req.params.waveId, operator);
    res.json({ success: true, data: wave });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:waveId/report-picked', (req, res) => {
  try {
    const { picked_results } = req.body;
    const operator = req.headers['x-operator'] || 'system';

    if (!picked_results || !Array.isArray(picked_results)) {
      return res.status(400).json({ success: false, error: 'picked_results 必须是数组' });
    }

    const result = core.reportPicked(req.params.waveId, picked_results, operator);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/stockouts', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const stockout = core.reportStockout(req.body, operator);
    res.json({ success: true, data: stockout });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/stockouts/:stockoutId', (req, res) => {
  try {
    const stockout = core.getStockoutById(req.params.stockoutId);
    if (!stockout) {
      return res.status(404).json({ success: false, error: '缺货记录不存在' });
    }
    res.json({ success: true, data: stockout });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/stockouts/:stockoutId/suggest-transfer', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const result = core.generateTransferSuggestion(req.params.stockoutId, operator);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/stockouts/:stockoutId/split', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const result = core.splitOrderForStockout(req.params.stockoutId, operator);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/stockouts/:stockoutId/execute-transfer', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const result = core.executeTransfer(req.params.stockoutId, operator);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/stockouts/:stockoutId/retain', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const stockout = core.retainStockout(req.params.stockoutId, operator);
    res.json({ success: true, data: stockout });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:waveId/complete', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const wave = core.completeWave(req.params.waveId, operator);
    res.json({ success: true, data: wave });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/:waveId/report', (req, res) => {
  try {
    const report = core.generateWaveReport(req.params.waveId);
    if (!report) {
      return res.status(404).json({ success: false, error: '波次不存在' });
    }
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/:waveId/inventory-report', (req, res) => {
  try {
    const report = core.generateInventoryChangeReport(req.params.waveId);
    if (!report) {
      return res.status(404).json({ success: false, error: '波次不存在' });
    }
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
