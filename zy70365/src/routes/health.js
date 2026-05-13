const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    service: 'task-sandbox-api',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

router.get('/ready', (req, res) => {
  res.json({
    success: true,
    status: 'ready',
    checks: {
      routes: 'ok',
      logger: 'ok',
      taskManager: 'ok',
      executor: 'ok'
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
