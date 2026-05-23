const express = require('express');
const path = require('path');
const fs = require('fs');

const customersRouter = require('./routes/customers');
const storesRouter = require('./routes/stores');
const packagesRouter = require('./routes/packages');
const transfersRouter = require('./routes/transfers');
const extensionsRouter = require('./routes/extensions');
const reportsRouter = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use('/api/customers', customersRouter);
app.use('/api/stores', storesRouter);
app.use('/api/packages', packagesRouter);
app.use('/api/transfers', transfersRouter);
app.use('/api/extensions', extensionsRouter);
app.use('/api/reports', reportsRouter);

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'running',
    message: '美容院疗程核销API服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    name: '美容院疗程核销API',
    version: '1.0.0',
    description: '提供顾客管理、疗程包管理、转店申请、延期申请、核销记录、报告导出等功能',
    endpoints: {
      customers: '/api/customers',
      stores: '/api/stores',
      packages: '/api/packages',
      transfers: '/api/transfers',
      extensions: '/api/extensions',
      reports: '/api/reports',
      health: '/api/health'
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    status: 'error',
    error: '服务器内部错误'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    status: 'not_found',
    error: '接口不存在'
  });
});

app.listen(PORT, () => {
  console.log(`美容院疗程核销API服务已启动，运行在 http://localhost:${PORT}`);
});

module.exports = app;
