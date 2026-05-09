require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const config = require('./config/config');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const setupAssociations = require('./models/associations');
const { initDatabase } = require('./models');

const lineStopsRouter = require('./routes/lineStops');

const app = express();

const dataDir = path.dirname(config.db.storage);
const logsDir = './logs';

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body ? Object.keys(req.body).join(',') : 'none'
  });
  next();
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0'
    }
  });
});

app.use('/api/line-stops', lineStopsRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `路由不存在: ${req.method} ${req.path}`
    }
  });
});

app.use((err, req, res, next) => {
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(e => ({
      field: e.path,
      message: e.message
    }));
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '数据验证失败',
        details: errors
      }
    });
  }
  
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      error: {
        code: 'UNIQUE_CONSTRAINT',
        message: '数据唯一性约束失败',
        details: err.errors
      }
    });
  }

  errorHandler(err, req, res, next);
});

const startServer = async () => {
  try {
    setupAssociations();
    await initDatabase();
    
    app.listen(config.port, () => {
      logger.info(`服务器启动成功`, {
        port: config.port,
        nodeEnv: config.nodeEnv,
        database: config.db.storage
      });
      console.log(`\n========================================`);
      console.log(`生产停线复盘服务已启动`);
      console.log(`端口: ${config.port}`);
      console.log(`环境: ${config.nodeEnv}`);
      console.log(`健康检查: http://localhost:${config.port}/api/health`);
      console.log(`========================================\n`);
    });
  } catch (error) {
    logger.error('服务器启动失败:', error);
    console.error('服务器启动失败:', error.message);
    process.exit(1);
  }
};

startServer();

process.on('unhandledRejection', (err) => {
  logger.error('未处理的Promise拒绝:', err);
});

process.on('uncaughtException', (err) => {
  logger.error('未捕获的异常:', err);
  process.exit(1);
});

module.exports = app;
