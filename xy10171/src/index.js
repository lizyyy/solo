const express = require('express');
const { initDb } = require('./db');
const exchangeRoutes = require('./routes/exchanges');
const inventoryRoutes = require('./routes/inventory');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/api/exchanges', exchangeRoutes);
app.use('/api/inventory', inventoryRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    code: 500,
    message: '服务器内部错误',
    data: null
  });
});

async function startServer() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`换货状态机 API 服务已启动: http://localhost:${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/api/health`);
    console.log(`换货单 API: http://localhost:${PORT}/api/exchanges`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
