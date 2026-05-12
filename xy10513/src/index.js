const express = require('express');
const database = require('./database');
const memberRoutes = require('./routes/member');
const batchRoutes = require('./routes/batch');
const freezeRoutes = require('./routes/freeze');
const consumeRoutes = require('./routes/consume');
const refundRoutes = require('./routes/refund');
const expireRoutes = require('./routes/expire');
const ledgerRoutes = require('./routes/ledger');
const adjustRoutes = require('./routes/adjust');
const reportRoutes = require('./routes/report');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  req.requestId = require('uuid').v4();
  console.log(`[${new Date().toISOString()}] ${req.requestId} ${req.method} ${req.path}`);
  next();
});

app.use('/api/members', memberRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/freeze', freezeRoutes);
app.use('/api/consume', consumeRoutes);
app.use('/api/refund', refundRoutes);
app.use('/api/expire', expireRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/adjust', adjustRoutes);
app.use('/api/reports', reportRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', requestId: req.requestId });
});

app.use((err, req, res, next) => {
  console.error(`[${req.requestId}] Error:`, err);
  res.status(500).json({
    code: 'SYSTEM_ERROR',
    message: err.message || '系统内部错误',
    requestId: req.requestId
  });
});

app.use((req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: '接口不存在',
    requestId: req.requestId
  });
});

async function start() {
  await database.init();
  
  if (process.env.SEED_DATA !== 'false') {
    const seed = require('./seed');
    seed.loadDemoData();
  }

  app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  会员积分过期 API 服务已启动`);
    console.log(`  服务地址: http://localhost:${PORT}`);
    console.log(`  健康检查: http://localhost:${PORT}/health`);
    console.log(`========================================\n`);
    console.log(`演示数据已加载，可直接运行: npm run demo`);
    console.log(`失败路径演示: npm run demo-fail\n`);
  });
}

start().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
