const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { execSync } = require('child_process');
const migrationRoutes = require('./routes/migration');
const idempotencyMiddleware = require('./middleware/idempotency');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(idempotencyMiddleware);

app.use('/api/migration', migrationRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'db-migration-preview-api'
    }
  });
});

app.use((err, req, res, next) => {
  logger.error('未处理的错误', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    path: req.path
  });
});

const initDatabase = () => {
  const dbPath = path.join(__dirname, '../../data/database.db');
  const fs = require('fs');
  
  if (!fs.existsSync(dbPath)) {
    try {
      const initScriptPath = path.join(__dirname, '../scripts/init-db.js');
      execSync(`node ${initScriptPath}`, { stdio: 'inherit' });
      logger.info('数据库初始化完成');
    } catch (error) {
      logger.error('数据库初始化失败', { error: error.message });
    }
  }
};

app.listen(PORT, () => {
  initDatabase();
  logger.info(`服务器运行在 http://localhost:${PORT}`);
  logger.info(`API 文档: http://localhost:${PORT}/api/health`);
});
