const express = require('express');
const router = express.Router();
const compressionService = require('../services/compressionService');

router.get('/strategies', async (req, res) => {
  try {
    const strategies = compressionService.getAllStrategies();
    res.json({ success: true, data: strategies });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/strategies', async (req, res) => {
  try {
    const strategy = compressionService.createStrategy(req.body);
    res.status(201).json({ success: true, data: strategy });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/strategies/:id', async (req, res) => {
  try {
    const strategy = compressionService.getStrategyById(req.params.id);
    if (!strategy) {
      return res.status(404).json({ success: false, message: '策略不存在' });
    }
    res.json({ success: true, data: strategy });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/strategies/:id', async (req, res) => {
  try {
    const strategy = compressionService.updateStrategy(req.params.id, req.body);
    if (!strategy) {
      return res.status(404).json({ success: false, message: '策略不存在' });
    }
    res.json({ success: true, data: strategy });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete('/strategies/:id', async (req, res) => {
  try {
    const result = compressionService.deleteStrategy(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: '策略不存在' });
    }
    res.json({ success: true, message: '策略已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/clients', async (req, res) => {
  try {
    const clients = compressionService.getAllClients();
    res.json({ success: true, data: clients });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/clients', async (req, res) => {
  try {
    const client = compressionService.createClient(req.body);
    res.status(201).json({ success: true, data: client });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/simulate', async (req, res) => {
  try {
    const result = compressionService.simulateRequest(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const history = compressionService.getHistory();
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/history/:id', async (req, res) => {
  try {
    const record = compressionService.getHistoryById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: '历史记录不存在' });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/rollback/:id', async (req, res) => {
  try {
    const result = compressionService.rollbackStrategy(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: '策略不存在或无可回滚版本' });
    }
    res.json({ success: true, data: result, message: '策略已回滚到上一版本' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/query', async (req, res) => {
  try {
    const result = compressionService.queryStatistics();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
