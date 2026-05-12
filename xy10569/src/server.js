const express = require('express');
const cors = require('cors');
const database = require('./database');

const baseRoutes = require('./routes/base');
const borrowRoutes = require('./routes/borrow');
const batchReturnRoutes = require('./routes/batchReturn');
const financialRoutes = require('./routes/financial');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/api/base', baseRoutes);
app.use('/api/borrows', borrowRoutes);
app.use('/api/batch-returns', batchReturnRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/reports', reportRoutes);

app.get('/', (req, res) => {
  res.json({
    success: true,
    service: '校园借书逾期 API',
    version: '1.0.0',
    endpoints: {
      '基础数据': '/api/base',
      '借阅管理': '/api/borrows',
      '批量归还': '/api/batch-returns',
      '财务处理': '/api/financial',
      '报告导出': '/api/reports',
      '健康检查': '/api/reports/health',
      '仪表盘': '/api/reports/dashboard'
    }
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

async function startServer() {
  await database.initDatabase();
  app.listen(PORT, () => {
    console.log('\n========================================');
    console.log('   校园借书逾期 API 已启动');
    console.log(`   http://localhost:${PORT}`);
    console.log('========================================\n');
    console.log('可用端点:');
    console.log(`  GET  http://localhost:${PORT}/`);
    console.log(`  GET  http://localhost:${PORT}/api/reports/health`);
    console.log(`  GET  http://localhost:${PORT}/api/reports/dashboard`);
    console.log(`  GET  http://localhost:${PORT}/api/base/students`);
    console.log(`  GET  http://localhost:${PORT}/api/borrows`);
    console.log(`  GET  http://localhost:${PORT}/api/reports/export?format=text`);
    console.log('\n');
  });
}

startServer().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
