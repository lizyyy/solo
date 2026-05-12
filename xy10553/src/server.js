const express = require('express');

const visitorRoutes = require('./routes/visitorRoutes');
const { runSeed } = require('../scripts/seed');

const app = express();
const PORT = process.env.PORT || 3000;
const AUTO_SEED = process.env.AUTO_SEED !== 'false';

app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use('/api/visitors', visitorRoutes);

app.post('/api/seed', (req, res) => {
  const data = runSeed();
  res.json({
    success: true,
    message: '样例数据已生成',
    data
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `路由不存在: ${req.method} ${req.path}`
  });
});

function startServer(port = PORT, autoSeed = AUTO_SEED) {
  if (autoSeed) {
    console.log('启动时自动加载样例数据...');
    runSeed();
  }
  
  const server = app.listen(port, () => {
    console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
    console.log(`║  机房访客陪同 API 服务已启动                                   ║`);
    console.log(`║  服务地址: http://localhost:${port}                            ║`);
    console.log(`╠══════════════════════════════════════════════════════════════╣`);
    console.log(`║  健康检查: GET  /health                                       ║`);
    console.log(`║  API 基础: /api/visitors                                      ║`);
    console.log(`╠══════════════════════════════════════════════════════════════╣`);
    console.log(`║  主要接口:                                                    ║`);
    console.log(`║  POST /api/visitors/applications          - 创建访客申请      ║`);
    console.log(`║  GET  /api/visitors/applications/:id      - 查询访客详情      ║`);
    console.log(`║  POST /api/visitors/applications/:id/...  - 推进状态流转      ║`);
    console.log(`║  GET  /api/visitors/timeline/:id          - 时间线视图        ║`);
    console.log(`║  GET  /api/visitors/reports/audit         - 审计报告          ║`);
    console.log(`║  POST /api/seed                          - 重新造数          ║`);
    console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
