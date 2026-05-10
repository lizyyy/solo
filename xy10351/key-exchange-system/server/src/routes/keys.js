const express = require('express');
const KeyService = require('../services/KeyService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const keys = await KeyService.getAllKeys();
    res.json(keys);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const key = await KeyService.getKeyById(req.params.id);
    if (!key) return res.status(404).json({ error: '钥匙不存在' });
    res.json(key);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const operator = { name: req.body.operator || '系统', role: 'admin' };
    const key = await KeyService.createKey(req.body.keyData, operator);
    res.status(201).json(key);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const operator = { name: req.body.operator || '系统', role: 'admin' };
    const key = await KeyService.updateKey(req.params.id, req.body.keyData, operator);
    res.json(key);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/pickup', async (req, res) => {
  try {
    const { operator, orderId, expectedReturnTime, remarks } = req.body;
    const result = await KeyService.pickUpKey(
      req.params.id,
      operator,
      orderId,
      expectedReturnTime,
      remarks
    );
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/return', async (req, res) => {
  try {
    const { operator, remarks } = req.body;
    const result = await KeyService.returnKey(req.params.id, operator, remarks);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const history = await KeyService.getKeyHistory(req.params.id);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/status/overdue', async (req, res) => {
  try {
    const overdueKeys = await KeyService.getOverdueKeys();
    res.json(overdueKeys);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
