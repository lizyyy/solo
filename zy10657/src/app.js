const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
}

const requiredConfigs = ['PORT', 'EXPORT_DIR'];
const missingConfigs = requiredConfigs.filter(config => !process.env[config]);
if (missingConfigs.length > 0) {
  console.warn('========================================');
  console.warn('警告：缺少以下配置项');
  console.warn('请在 .env 文件中添加：');
  missingConfigs.forEach(config => {
    console.warn(`  ${config}=${config === 'PORT' ? '3000' : './exports'}`);
  });
  console.warn('========================================');
  
  process.env.PORT = process.env.PORT || '3000';
  process.env.EXPORT_DIR = process.env.EXPORT_DIR || './exports';
}

const callRecordRoutes = require('./routes/callRecords');
const callRecordService = require('./services/CallRecordService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/', (req, res) => {
  res.json({
    name: '智能外呼平台号码重复呼叫拦截 API',
    version: '1.0.0',
    description: '提供号码重复呼叫拦截、审核、撤回、列表、详情和导出功能',
    endpoints: {
      'POST /api/call-records': '创建呼叫记录',
      'PUT /api/call-records/:id': '修改呼叫记录',
      'POST /api/call-records/:id/review': '审核拦截记录',
      'POST /api/call-records/:id/withdraw': '撤回呼叫记录',
      'POST /api/call-records/:id/mark-called': '标记为已呼叫',
      'GET /api/call-records': '获取呼叫记录列表',
      'GET /api/call-records/:id': '获取呼叫记录详情',
      'POST /api/call-records/bulk-import': '批量导入',
      'POST /api/call-records/export': '导出呼叫记录',
      'GET /api/call-records/:id/export-history': '导出历史记录',
      'GET /api/call-records/export/files': '获取导出文件列表',
      'GET /api/task-batches': '获取任务批次列表',
      'GET /api/customers': '获取客户列表',
      'GET /api/status': '获取状态说明'
    }
  });
});

app.use('/api/call-records', callRecordRoutes);

app.get('/api/task-batches', (req, res) => {
  res.json({
    success: true,
    data: callRecordService.getTaskBatches()
  });
});

app.get('/api/customers', (req, res) => {
  res.json({
    success: true,
    data: callRecordService.getCustomers()
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    data: {
      pending: '待呼叫',
      intercepted: '已拦截',
      called: '已呼叫',
      archived: '已归档',
      import_error: '导入错误'
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

app.listen(PORT, () => {
  console.log('========================================');
  console.log('智能外呼平台号码重复呼叫拦截 API');
  console.log('========================================');
  console.log(`服务已启动，监听端口: ${PORT}`);
  console.log(`API 地址: http://localhost:${PORT}`);
  console.log(`导出目录: ${process.env.EXPORT_DIR}`);
  console.log('========================================');
  console.log('快速开始:');
  console.log(`  curl http://localhost:${PORT}`);
  console.log(`  curl http://localhost:${PORT}/api/call-records`);
  console.log('========================================');
});

module.exports = app;
