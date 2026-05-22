const express = require('express');
const path = require('path');
const fs = require('fs');
const batchRoutes = require('./routes/batches');

const app = express();
const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, '../data/uploads');
const dbDir = path.join(__dirname, '../data/db');
const exportDir = path.join(__dirname, '../data/exports');

[uploadDir, dbDir, exportDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/', (req, res) => {
  res.json({
    name: '冷链中转验收回放链路 API',
    version: '1.0.0',
    endpoints: {
      submit: 'POST /api/batches/submit',
      list: 'GET /api/batches',
      detail: 'GET /api/batches/:batchId',
      withdraw: 'POST /api/batches/:batchId/withdraw',
      resubmit: 'POST /api/batches/resubmit/:batchNo',
      adjust_compensation: 'POST /api/batches/:batchId/adjust/compensation',
      adjust_status: 'POST /api/batches/:batchId/adjust/status',
      freeze: 'POST /api/batches/:batchId/freeze',
      unfreeze: 'POST /api/batches/:batchId/unfreeze',
      export: 'POST /api/batches/:batchId/export',
      history: 'GET /api/batches/:batchId/history',
      replay: 'GET /api/batches/:batchId/replay',
      photo_upload: 'POST /api/batches/:batchId/photo/upload'
    }
  });
});

app.use('/api/batches', batchRoutes);

app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    success: false,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: '接口不存在' });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`冷链中转验收回放链路 API 服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`数据库位置: ${dbDir}`);
  console.log(`上传目录: ${uploadDir}`);
  console.log(`导出目录: ${exportDir}`);
  console.log(`========================================\n`);
});

module.exports = app;
