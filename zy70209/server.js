const express = require('express');
const bodyParser = require('body-parser');
const { ensureDbReady, closeDb } = require('./db/connection');
const idempotentMiddleware = require('./middleware/idempotent');

const donationsRouter = require('./routes/donations');
const testsRouter = require('./routes/tests');
const batchesRouter = require('./routes/batches');
const distributionRouter = require('./routes/distribution');
const reportsRouter = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(idempotentMiddleware);

app.get('/', (req, res) => {
  res.json({
    name: '母乳库冻存批次追踪 API',
    version: '1.0.0',
    description: '追踪捐赠、检测、冻存和发放流程，确保批次追溯能力',
    endpoints: {
      donations: '/api/donations',
      tests: '/api/tests',
      batches: '/api/batches',
      distribution: '/api/distribution',
      reports: '/api/reports'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/donations', donationsRouter);
app.use('/api/tests', testsRouter);
app.use('/api/batches', batchesRouter);
app.use('/api/distribution', distributionRouter);
app.use('/api/reports', reportsRouter);

app.use((req, res) => {
  res.status(404).json({
    error: '接口不存在',
    code: 'NOT_FOUND',
    path: req.path
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: '服务器内部错误',
    code: 'INTERNAL_ERROR',
    message: err.message
  });
});

async function startServer(port = PORT) {
  await ensureDbReady();
  
  const server = app.listen(port, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║           母乳库冻存批次追踪 API 已启动                      ║
╠════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${port}                          ║
║  健康检查: http://localhost:${port}/health                   ║
║  API 文档: http://localhost:${port}/                         ║
╠════════════════════════════════════════════════════════════╣
║  主要接口:                                                  ║
║    POST   /api/donations                    - 登记捐赠       ║
║    POST   /api/tests                        - 录入检测结果   ║
║    POST   /api/batches                      - 创建冻存批次   ║
║    POST   /api/distribution/distribute      - 发放登记       ║
║    POST   /api/distribution/recalls         - 发起召回       ║
║    GET    /api/reports/inventory            - 库存报表       ║
║    GET    /api/batches/:id/traceability     - 批次追溯       ║
╚════════════════════════════════════════════════════════════╝
    `);
  });

  process.on('SIGINT', async () => {
    console.log('正在关闭服务...');
    await closeDb();
    server.close(() => {
      console.log('服务已关闭');
      process.exit(0);
    });
  });

  process.on('SIGTERM', async () => {
    console.log('正在关闭服务...');
    await closeDb();
    server.close(() => {
      console.log('服务已关闭');
      process.exit(0);
    });
  });

  return { app, server, port };
}

if (require.main === module) {
  startServer().catch(console.error);
}

module.exports = { app, startServer, closeDb };
