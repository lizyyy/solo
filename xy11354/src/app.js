const express = require('express');
const path = require('path');
const initDatabase = require('./models/init');
const logger = require('./config/logger');

const importRoutes = require('./routes/import');
const verifyRoutes = require('./routes/verify');
const reviewRoutes = require('./routes/review');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/import', importRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '园区安保系统运行正常' });
});

app.use((err, req, res, next) => {
  logger.error('Server error:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

async function startServer() {
  try {
    await initDatabase();
    logger.info('数据库初始化完成');
    
    app.listen(PORT, () => {
      logger.info(`\n${'='.repeat(60)}`);
      logger.info(`园区安保系统已启动`);
      logger.info(`服务端口: ${PORT}`);
      logger.info(`健康检查: http://localhost:${PORT}/api/health`);
      logger.info(`${'='.repeat(60)}\n`);
    });
  } catch (error) {
    logger.error('启动失败:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
