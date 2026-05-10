const express = require('express');

function createRequestsRouter(service) {
  const router = express.Router();

  router.post('/recall', (req, res) => {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: userId'
      });
    }

    const result = service.processRecallRequest(userId);

    res.json({
      success: true,
      data: result
    });
  });

  router.get('/degradation-info', (req, res) => {
    const info = service.getDegradationInfo();

    res.json({
      success: true,
      data: info
    });
  });

  router.get('/available-sources', (req, res) => {
    const sources = service.getAvailableSources().map(s => ({
      id: s.id,
      name: s.name,
      state: s.currentState,
      weight: s.getWeight()
    }));

    res.json({
      success: true,
      data: {
        count: sources.length,
        sources
      }
    });
  });

  return router;
}

module.exports = {
  createRequestsRouter
};