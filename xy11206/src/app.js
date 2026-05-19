const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const deliveryRoutes = require('./routes/delivery');
const inventoryRoutes = require('./routes/inventory');
const logRoutes = require('./routes/logs');
const { OperationLogger, logger } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const operationLogger = new OperationLogger(require('./database'));

app.use((req, res, next) => {
  const originalSend = res.send;
  let responseData;
  
  res.send = function(data) {
    try {
      responseData = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
      responseData = data;
    }
    return originalSend.call(this, data);
  };

  res.on('finish', () => {
    operationLogger.log(req, res, responseData).catch(err => {
      logger.error('日志记录失败:', err);
    });
  });

  next();
});

app.use('/api/delivery', deliveryRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/logs', logRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    name: '社区药房库存管理系统',
    version: '1.0.0',
    description: '疫苗和胰岛素冷链管理后端服务',
    endpoints: {
      delivery: '/api/delivery',
      inventory: '/api/inventory',
      logs: '/api/logs',
      health: '/api/health'
    }
  });
});

app.use((err, req, res, next) => {
  logger.error('未处理的错误:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  logger.info(`服务器运行在 http://localhost:${PORT}`);
  logger.info('社区药房库存管理系统启动成功');
});

module.exports = app;
