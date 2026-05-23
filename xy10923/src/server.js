const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

require('./config/database');

const detourRoutes = require('./routes/detourRoutes');
const baseDataRoutes = require('./routes/baseDataRoutes');
const exportRoutes = require('./routes/exportRoutes');
const errorHandler = require('./middleware/errorHandler');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use('/api/detours', detourRoutes);
app.use('/api/base', baseDataRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '校车临时改线API服务运行正常', timestamp: new Date().toISOString() });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: '校车临时改线API',
    version: '1.0.0',
    endpoints: {
      detours: {
        list: 'GET /api/detours',
        create: 'POST /api/detours',
        get: 'GET /api/detours/:id',
        status: 'POST /api/detours/:id/status',
        correct: 'POST /api/detours/:id/correct',
        report: 'GET /api/detours/:id/report',
        receipts: 'GET /api/detours/:id/receipts'
      },
      base: {
        routes: 'GET /api/base/routes',
        stops: 'GET /api/base/stops',
        students: 'GET /api/base/students',
        reasons: 'GET /api/base/detour-reasons'
      },
      export: {
        json: 'GET /api/export/detour/:id/json',
        csv: 'GET /api/export/detour/:id/csv',
        full_csv: 'GET /api/export/detour/:id/full-csv'
      }
    }
  });
});

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 校车临时改线API服务已启动`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`📊 API文档: http://localhost:${PORT}/api`);
  console.log(`💓 健康检查: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
