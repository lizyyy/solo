const express = require('express');
const { initSampleData } = require('./data/store');
const { errorHandler, BusinessError } = require('./services/errors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

initSampleData();

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '办公资产调拨 API 系统',
    version: '1.0.0',
    endpoints: {
      assets: '/api/assets',
      transfers: '/api/transfers',
      inventory: '/api/inventory',
      reports: '/api/reports',
      tasks: '/api/tasks'
    }
  });
});

app.use('/api/assets', require('./routes/assets'));
app.use('/api/transfers', require('./routes/transfers'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/reports', require('./routes/reports'));

app.use('/api/tasks', require('./routes/tasks'));

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: '接口不存在'
    }
  });
});

app.use((err, req, res, next) => {
  if (err instanceof BusinessError) {
    return res.status(400).json(err.toResponse());
  }
  
  console.error('[ERROR]', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  办公资产调拨 API 系统已启动`);
    console.log(`  服务地址: http://localhost:${PORT}`);
    console.log(`  API 文档: http://localhost:${PORT}`);
    console.log(`========================================\n`);
  });
}

module.exports = app;
