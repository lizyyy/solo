const express = require('express');
const cors = require('cors');
const { initTables } = require('./models');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const startServer = async () => {
  await initDatabase();
  initTables();

  const adjustmentRoutes = require('./routes/adjustments');
  const storeTaskRoutes = require('./routes/storeTasks');
  const exceptionRoutes = require('./routes/exceptions');
  const storeRoutes = require('./routes/stores');
  const regionRoutes = require('./routes/regions');
  const productRoutes = require('./routes/products');

  app.use('/api/adjustments', adjustmentRoutes);
  app.use('/api/store-tasks', storeTaskRoutes);
  app.use('/api/exceptions', exceptionRoutes);
  app.use('/api/stores', storeRoutes);
  app.use('/api/regions', regionRoutes);
  app.use('/api/products', productRoutes);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.listen(PORT, () => {
    console.log(`门店价签生效台 - 后端服务启动中...`);
    console.log(`服务地址: http://localhost:${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/api/health`);
  });
};

startServer();
