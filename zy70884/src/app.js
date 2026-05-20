const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const batchesRouter = require('./routes/batches');
const contractsRouter = require('./routes/contracts');
const sealRulesRouter = require('./routes/sealRules');
const auditLogsRouter = require('./routes/auditLogs');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/batches', batchesRouter);
app.use('/api/contracts', contractsRouter);
app.use('/api/seal-rules', sealRulesRouter);
app.use('/api/audit-logs', auditLogsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`法务合同追踪系统已启动`);
  console.log(`服务运行在 http://localhost:${PORT}`);
  console.log('');
  console.log('API 接口:');
  console.log('  GET  /api/health - 健康检查');
  console.log('  POST /api/batches - 创建批次');
  console.log('  GET  /api/batches - 获取所有批次');
  console.log('  GET  /api/batches/:id - 获取批次详情');
  console.log('  POST /api/batches/:id/import-csv - 导入合同CSV');
  console.log('  PUT  /api/batches/:id/status - 更新批次状态');
  console.log('  POST /api/batches/:id/return - 退回修改');
  console.log('  GET  /api/batches/:id/export - 导出批次数据');
  console.log('  GET  /api/contracts - 查询合同');
  console.log('  GET  /api/contracts/trace - 按快递单号追溯');
  console.log('  GET  /api/contracts/:id - 获取合同详情');
  console.log('  PUT  /api/contracts/:id/process - 标记处理');
  console.log('  POST /api/contracts/:id/return - 退回修改');
  console.log('  POST /api/contracts/:id/unauthorized-seal - 记录越权盖章');
  console.log('  POST /api/contracts/:id/attachment-supplement - 记录补盖附件');
  console.log('  POST /api/contracts/:id/withdraw-resubmit - 记录撤回重提');
  console.log('  GET  /api/contracts/export/detail - 导出明细');
  console.log('  POST /api/seal-rules - 创建印章规则');
  console.log('  GET  /api/seal-rules - 获取所有印章规则');
  console.log('  GET  /api/audit-logs - 获取审计日志');
});

module.exports = app;
