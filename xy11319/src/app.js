const express = require('express');
const path = require('path');
const { initDatabase } = require('./config/database');
const logger = require('./config/logger');
const setupRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

setupRoutes(app);

async function startServer() {
  try {
    await initDatabase();
    logger.info('Database initialized successfully');

    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/api/health`);
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║           校车调度员乱账治理系统已启动                          ║
╠══════════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                              ║
║  健康检查: http://localhost:${PORT}/api/health                   ║
║  数据统计: http://localhost:${PORT}/api/stats                    ║
╚══════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;