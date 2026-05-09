const express = require('express');
const { AppError, ErrorCode } = require('./utils/errors');
const logger = require('./utils/logger');
const quotaRoutes = require('./routes/quota');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  res.status(200).json({
    code: 0,
    message: '服务正常',
    data: {
      timestamp: new Date().toISOString(),
      service: 'quota-approval-service',
      version: '1.0.0',
    },
  });
});

app.use('/api/v1/quota', quotaRoutes);

app.use((req, res) => {
  res.status(404).json({
    code: 404,
    message: '路由不存在',
    data: null,
  });
});

app.use((error, req, res, next) => {
  logger.error('请求处理错误:', error);

  if (error instanceof AppError) {
    return res.status(400).json({
      code: error.code,
      message: error.message,
      data: error.details || null,
    });
  }

  if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
    return res.status(400).json({
      code: 4000,
      message: 'JSON 格式错误',
      data: null,
    });
  }

  return res.status(500).json({
    code: 5000,
    message: '内部服务器错误',
    data: null,
  });
});

module.exports = app;
