const express = require('express');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const db = require('./database/init');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '亲子游泳馆水温记录API运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('API文档:');
  console.log('  GET  /health - 健康检查');
  console.log('  POST /api/import/csv - 导入CSV');
  console.log('  GET  /api/import/batches - 获取导入批次');
  console.log('  GET  /api/import/bad-records/:batchNo - 获取坏记录');
  console.log('  GET  /api/records - 获取记录列表');
  console.log('  GET  /api/records/:id - 获取单条记录');
  console.log('  POST /api/records - 创建记录');
  console.log('  PUT  /api/records/:id/status - 更新状态');
  console.log('  POST /api/records/:id/manual-review - 人工审核继续');
  console.log('  GET  /api/records/:id/logs - 获取状态日志');
  console.log('  GET  /api/summary - 获取统计汇总');
  console.log('  GET  /api/export/excel - 导出Excel');
  console.log('  GET  /api/export/csv - 导出CSV');
  console.log('  POST /api/migration/migrate - 历史数据迁移');
  console.log('  GET  /api/migration/records - 获取迁移历史');
  console.log('  GET  /api/migration/comparison/:old_id - 迁移前后对比');
});

module.exports = app;