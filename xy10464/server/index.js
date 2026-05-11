const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./database');

async function startServer() {
  await initializeDatabase();
  
  const { seedDatabase } = require('./seedData');
  await seedDatabase();
  
  const contractsRouter = require('./routes/contracts');
  const workOrdersRouter = require('./routes/workOrders');
  const exemptionsRouter = require('./routes/exemptions');
  const settlementsRouter = require('./routes/settlements');
  
  const app = express();
  const PORT = process.env.PORT || 3001;

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'SLA罚款台服务运行中' });
  });

  app.use('/api/contracts', contractsRouter);
  app.use('/api/workorders', workOrdersRouter);
  app.use('/api/exemptions', exemptionsRouter);
  app.use('/api/settlements', settlementsRouter);

  const clientBuildPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientBuildPath));

  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    }
  });

  app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
  });

  app.listen(PORT, () => {
    console.log(`SLA罚款台服务运行在端口 ${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/api/health`);
  });
}

startServer().catch(err => {
  console.error('启动服务器失败:', err);
  process.exit(1);
});
