const express = require('express');
const { initDatabase, seedTestData } = require('./config/init-db');

const transactionsRouter = require('./routes/transactions');
const failureInjectionRouter = require('./routes/failure-injection');
const servicesRouter = require('./routes/services');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Distributed Transaction Demo'
  });
});

app.use('/api/transactions', transactionsRouter);
app.use('/api/failure', failureInjectionRouter);
app.use('/api/services', servicesRouter);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    availableEndpoints: [
      'GET  /health',
      'POST /api/transactions/transfer',
      'GET  /api/transactions/:id',
      'GET  /api/transactions/:id/timeline',
      'GET  /api/transactions/:id/report/json',
      'GET  /api/transactions/:id/report/markdown',
      'POST /api/failure/inject',
      'POST /api/failure/clear',
      'GET  /api/failure/active',
      'GET  /api/services/warehouse/inventory',
      'GET  /api/services/accounting/accounts',
      'GET  /api/services/logistics/shipments'
    ]
  });
});

const startServer = async () => {
  try {
    initDatabase();
    seedTestData();
    
    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`  分布式事务演练系统`);
      console.log(`========================================`);
      console.log(`服务运行于: http://localhost:${PORT}`);
      console.log(`健康检查:   http://localhost:${PORT}/health`);
      console.log(`\nAPI 端点:`);
      console.log(`  - 事务操作:   /api/transactions`);
      console.log(`  - 失败注入:   /api/failure`);
      console.log(`  - 服务数据:   /api/services`);
      console.log(`\n========================================\n`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
};

startServer();
