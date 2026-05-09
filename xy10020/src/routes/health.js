const express = require('express');
const { getDb } = require('../database/client');
const { getRedisClient } = require('../redis/client');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const redis = getRedisClient();

    const dbResult = db.prepare('SELECT 1 as alive').get();
    const redisAlive = await redis.ping();

    res.json({
      status: 'healthy',
      timestamp: Date.now(),
      components: {
        database: dbResult.alive === 1 ? 'healthy' : 'unhealthy',
        redis: redisAlive === 'PONG' ? 'healthy' : 'unhealthy'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: Date.now(),
      error: error.message
    });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const webSocketService = req.app.locals.webSocketService;
    const pushTaskService = req.app.locals.pushTaskService;

    const stats = {
      timestamp: Date.now(),
      websocket: webSocketService ? webSocketService.getStatistics() : null
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

module.exports = router;
