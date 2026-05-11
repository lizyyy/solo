const express = require('express');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

const membersRouter = require('./routes/members');
const transactionsRouter = require('./routes/transactions');
const settlementsRouter = require('./routes/settlements');

app.use('/api/members', membersRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/settlements', settlementsRouter);

app.get('/api/tiers', (req, res) => {
  db.all('SELECT * FROM tiers ORDER BY min_points ASC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`会员等级保级 API 服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`接口说明:`);
  console.log(`  POST /api/members - 会员建档`);
  console.log(`  POST /api/transactions/consume - 消费入账`);
  console.log(`  POST /api/transactions/refund - 退款`);
  console.log(`  POST /api/transactions/adjust - 积分调整`);
  console.log(`  POST /api/settlements/settle/:period - 周期结算`);
  console.log(`  POST /api/settlements/confirm - 等级确认`);
  console.log(`  POST /api/settlements/recalculate/:period - 重算`);
  console.log(`  GET  /api/settlements/statistics/:period - 各等级人数统计`);
  console.log(`  GET  /api/settlements/critical/:period - 临界会员`);
  console.log(`  GET  /api/transactions/anomalous - 异常流水`);
  console.log(`  GET  /api/settlements/history/:period - 结算历史`);
});
