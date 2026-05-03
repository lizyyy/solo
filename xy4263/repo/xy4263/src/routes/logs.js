const express = require('express');
const router = express.Router();

module.exports = (storage) => {
  router.get('/', (req, res) => {
    const { subscription_id, limit } = req.query;
    const limitNum = parseInt(limit) || 100;
    
    const logs = storage.getAllDeliveryLogs(subscription_id || null, limitNum);
    res.json(logs);
  });

  router.get('/stats', (req, res) => {
    const stats = storage.getStats();
    res.json(stats);
  });

  return router;
};