const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./config/database');
const errorHandler = require('./middlewares/errorHandler');

const specimenRoutes = require('./routes/specimen');
const batchRoutes = require('./routes/batch');
const chainRoutes = require('./routes/chain');
const reportRoutes = require('./routes/report');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/specimens', specimenRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/chain-segments', chainRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`病理标本外送 API 服务已启动: http://localhost:${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error('启动服务失败:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app;
