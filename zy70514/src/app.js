const express = require('express');
const path = require('path');
const fs = require('fs');
const budgetFreezeRoutes = require('./routes/budgetFreezeRoutes');
const budgetInterceptor = require('./middleware/budgetInterceptor');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/protected', budgetInterceptor);

app.get('/api/protected/test', (req, res) => {
  res.json({
    message: 'API调用成功',
    budgetInfo: req.budgetInfo
  });
});

app.get('/api/protected/premium/test', (req, res) => {
  res.json({
    message: '高级API调用成功',
    budgetInfo: req.budgetInfo
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/budget-freezes', budgetFreezeRoutes);

app.use((req, res, next) => {
  res.status(404).json({ error: 'Not found', path: req.path, method: req.method });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log('API端点:');
  console.log('  GET  /health - 健康检查');
  console.log('  POST /api/budget-freezes - 创建预算冻结记录');
  console.log('  GET  /api/budget-freezes - 查询预算冻结记录列表');
  console.log('  GET  /api/budget-freezes/:id - 查询冻结记录详情');
  console.log('  POST /api/budget-freezes/:id/confirm - 确认冻结');
  console.log('  POST /api/budget-freezes/:id/start-investigation - 启动排查');
  console.log('  POST /api/budget-freezes/:id/thaw-approvals - 申请解冻');
  console.log('  POST /api/budget-freezes/:id/exception - 异常处理');
  console.log('  POST /api/budget-freezes/manual-corrections - 人工修正');
  console.log('  GET  /api/budget-freezes/export/data - 导出JSON数据');
  console.log('  GET  /api/budget-freezes/export/csv - 导出CSV文件');
  console.log('  GET  /api/budget-freezes/usage/:accountId/summary - 用量汇总');
  console.log('  GET  /api/protected/test - 受保护的API测试');
  console.log('  GET  /api/protected/premium/test - 高级API测试');
});

module.exports = app;
