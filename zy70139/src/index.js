const express = require('express');
const { RecallService } = require('./core');
const { createSourcesRouter } = require('./api/sources');
const { createRequestsRouter } = require('./api/requests');
const { createReportsRouter } = require('./api/reports');

const PORT = process.env.PORT || 3000;

function createApp() {
  const app = express();
  const service = new RecallService();

  app.use(express.json());

  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  service.registerSource('user-cf', '用户协同过滤', {
    failureRateThreshold: 0.2,
    consecutiveFailuresThreshold: 3,
    circuitBreakerTimeoutMs: 30000
  });

  service.registerSource('item-cf', '物品协同过滤', {
    failureRateThreshold: 0.25,
    consecutiveFailuresThreshold: 4,
    circuitBreakerTimeoutMs: 45000
  });

  service.registerSource('content-based', '内容推荐', {
    failureRateThreshold: 0.3,
    consecutiveFailuresThreshold: 5,
    circuitBreakerTimeoutMs: 60000
  });

  service.registerSource('hot-items', '热门召回', {
    failureRateThreshold: 0.15,
    consecutiveFailuresThreshold: 2,
    circuitBreakerTimeoutMs: 20000
  });

  app.get('/', (req, res) => {
    res.json({
      success: true,
      data: {
        service: '推荐召回降级服务',
        version: '1.0.0',
        description: '提供召回源状态管理、降级策略、曝光记录和效果报表功能',
        endpoints: {
          sources: '/api/sources',
          requests: '/api/requests',
          reports: '/api/reports'
        }
      }
    });
  });

  app.use('/api/sources', createSourcesRouter(service));
  app.use('/api/requests', createRequestsRouter(service));
  app.use('/api/reports', createReportsRouter(service));

  app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: err.message
    });
  });

  return { app, service };
}

if (require.main === module) {
  const { app } = createApp();
  
  app.listen(PORT, () => {
    console.log(`推荐召回降级服务已启动，监听端口 ${PORT}`);
    console.log(`API 端点:`);
    console.log(`  GET  /`);
    console.log(`  GET  /api/sources`);
    console.log(`  POST /api/sources`);
    console.log(`  GET  /api/sources/:id`);
    console.log(`  POST /api/sources/:id/transition`);
    console.log(`  POST /api/sources/:id/record`);
    console.log(`  POST /api/sources/:id/evaluate`);
    console.log(`  POST /api/sources/evaluate-all`);
    console.log(`  POST /api/requests/recall`);
    console.log(`  GET  /api/requests/degradation-info`);
    console.log(`  GET  /api/requests/available-sources`);
    console.log(`  GET  /api/reports/summary`);
    console.log(`  GET  /api/reports/exposures`);
    console.log(`  GET  /api/reports/health`);
  });
}

module.exports = {
  createApp
};