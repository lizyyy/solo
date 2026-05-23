const express = require('express');
const router = express.Router();
const { BatchService, DataService, ReconcileService, ExportService, ReplayService } = require('../services');

router.get('/', async (req, res) => {
  try {
    const result = await BatchService.getBatchList(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { operator } = req.headers;
    if (!operator) return res.status(400).json({ success: false, error: '缺少操作人(operator)请求头' });
    
    const batch = await BatchService.createBatch(req.body, operator);
    res.json({ success: true, data: batch });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:batchId', async (req, res) => {
  try {
    const batch = await BatchService.getBatchDetail(req.params.batchId);
    res.json({ success: true, data: batch });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:batchId/submit', async (req, res) => {
  try {
    const { operator } = req.headers;
    if (!operator) return res.status(400).json({ success: false, error: '缺少操作人(operator)请求头' });
    
    const { duplicateStrategy } = req.body;
    const result = await BatchService.submitBatch(req.params.batchId, operator, duplicateStrategy);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:batchId/withdraw', async (req, res) => {
  try {
    const { operator } = req.headers;
    if (!operator) return res.status(400).json({ success: false, error: '缺少操作人(operator)请求头' });
    
    const { reason } = req.body;
    const batch = await BatchService.withdrawBatch(req.params.batchId, operator, reason);
    res.json({ success: true, data: batch });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:batchId/freeze', async (req, res) => {
  try {
    const { operator } = req.headers;
    if (!operator) return res.status(400).json({ success: false, error: '缺少操作人(operator)请求头' });
    
    const batch = await BatchService.freezeBatch(req.params.batchId, operator);
    res.json({ success: true, data: batch });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:batchId/unfreeze', async (req, res) => {
  try {
    const { operator } = req.headers;
    if (!operator) return res.status(400).json({ success: false, error: '缺少操作人(operator)请求头' });
    
    const batch = await BatchService.unfreezeBatch(req.params.batchId, operator);
    res.json({ success: true, data: batch });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:batchId/history', async (req, res) => {
  try {
    const history = await BatchService.getBatchHistory(req.params.batchId);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:batchId/data', async (req, res) => {
  try {
    const { operator } = req.headers;
    if (!operator) return res.status(400).json({ success: false, error: '缺少操作人(operator)请求头' });
    
    const result = await DataService.batchAdd(req.params.batchId, req.body, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:batchId/delivery-notes', async (req, res) => {
  try {
    const { operator } = req.headers;
    if (!operator) return res.status(400).json({ success: false, error: '缺少操作人(operator)请求头' });
    
    const note = await DataService.addDeliveryNote(req.params.batchId, req.body, operator);
    res.json({ success: true, data: note });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:batchId/weighing-records', async (req, res) => {
  try {
    const { operator } = req.headers;
    if (!operator) return res.status(400).json({ success: false, error: '缺少操作人(operator)请求头' });
    
    const record = await DataService.addWeighingRecord(req.params.batchId, req.body, operator);
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:batchId/photos', async (req, res) => {
  try {
    const { operator } = req.headers;
    if (!operator) return res.status(400).json({ success: false, error: '缺少操作人(operator)请求头' });
    
    const photo = await DataService.addPhoto(req.params.batchId, req.body, operator);
    res.json({ success: true, data: photo });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:batchId/loss-records', async (req, res) => {
  try {
    const { operator } = req.headers;
    if (!operator) return res.status(400).json({ success: false, error: '缺少操作人(operator)请求头' });
    
    const loss = await DataService.addLossRecord(req.params.batchId, req.body, operator);
    res.json({ success: true, data: loss });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:batchId/reconcile', async (req, res) => {
  try {
    const { operator } = req.headers;
    if (!operator) return res.status(400).json({ success: false, error: '缺少操作人(operator)请求头' });
    
    const result = await ReconcileService.reconcile(req.params.batchId, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:batchId/reconciliations', async (req, res) => {
  try {
    const reconciliations = await ReconcileService.getReconciliation(req.params.batchId);
    res.json({ success: true, data: reconciliations });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:batchId/export', async (req, res) => {
  try {
    const { operator } = req.headers;
    if (!operator) return res.status(400).json({ success: false, error: '缺少操作人(operator)请求头' });
    
    const { format } = req.body;
    const result = await ExportService.exportBatch(req.params.batchId, operator, format);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:batchId/replay', async (req, res) => {
  try {
    const timeline = await ReplayService.getReplayTimeline(req.params.batchId);
    res.json({ success: true, data: timeline });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
