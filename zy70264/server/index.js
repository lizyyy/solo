const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./models/database');

async function startServer() {
  await db.ready;

  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ success: true, message: '养老餐配送温度追踪台服务运行正常', timestamp: new Date().toISOString() });
  });

  const batchesRouter = require('./api/batches');
  const temperatureRouter = require('./api/temperature');
  const receiptsRouter = require('./api/receipts');
  const returnsRouter = require('./api/returns');
  const compensationsRouter = require('./api/compensations');
  const reportsRouter = require('./api/reports');
  const sampleDataRouter = require('./api/sampleData');

  app.use('/api/batches', batchesRouter);
  app.use('/api/temperature', temperatureRouter);
  app.use('/api/receipts', receiptsRouter);
  app.use('/api/returns', returnsRouter);
  app.use('/api/compensations', compensationsRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/sample-data', sampleDataRouter);

  app.use(express.static(path.join(__dirname, '../client/dist')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: '服务器内部错误', error: err.message });
  });

  app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`  养老餐配送温度追踪台 - 后端服务`);
    console.log(`  服务端口: ${PORT}`);
    console.log(`  服务地址: http://localhost:${PORT}`);
    console.log(`  健康检查: http://localhost:${PORT}/api/health`);
    console.log(`========================================`);
  });
}

startServer().catch(err => {
  console.error('服务器启动失败:', err);
  process.exit(1);
});
