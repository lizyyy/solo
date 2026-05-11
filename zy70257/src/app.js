const express = require('express');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const prescriptionsRouter = require('./routes/prescriptions');
const batchesRouter = require('./routes/batches');
const returnsRouter = require('./routes/returns');
const reportsRouter = require('./routes/reports');
const enumsRouter = require('./routes/enums');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    service: 'dental-denture-return-api'
  });
});

app.use('/api/enums', enumsRouter);
app.use('/api/prescriptions', prescriptionsRouter);
app.use('/api/batches', batchesRouter);
app.use('/api/returns', returnsRouter);
app.use('/api/reports', reportsRouter);

app.use((req, res) => {
  res.status(404).json({
    code: 40400,
    message: '接口不存在',
    path: req.path
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    code: 50000,
    message: '服务器内部错误',
    details: process.env.NODE_ENV === 'development' ? err.message : null
  });
});

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('口腔技工义齿返修管理系统 API');
  console.log('='.repeat(60));
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API 基础路径: http://localhost:${PORT}/api`);
  console.log('='.repeat(60));
  console.log('可用接口:');
  console.log('  - GET  /api/enums              - 获取枚举值');
  console.log('  - GET  /api/prescriptions       - 处方列表');
  console.log('  - POST /api/prescriptions       - 创建处方');
  console.log('  - GET  /api/prescriptions/:id   - 处方详情');
  console.log('  - GET  /api/batches             - 批次列表');
  console.log('  - POST /api/batches             - 创建批次');
  console.log('  - GET  /api/batches/:id         - 批次详情');
  console.log('  - GET  /api/batches/:id/workorders - 批次工序');
  console.log('  - POST /api/batches/:id/start   - 开始生产');
  console.log('  - GET  /api/returns             - 返修列表');
  console.log('  - POST /api/returns             - 提交返修');
  console.log('  - GET  /api/returns/:id         - 返修详情');
  console.log('  - POST /api/returns/:id/assign-responsibility - 责任归因');
  console.log('  - POST /api/returns/:id/start-rework - 开始返工');
  console.log('  - POST /api/returns/:id/resolve - 解决返修');
  console.log('  - GET  /api/reports/overview    - 总体统计');
  console.log('  - GET  /api/reports/responsibility - 责任归因报表');
  console.log('='.repeat(60));
});

module.exports = app;
