const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { initDatabase } = require('./database');
const deletionRoutes = require('./routes/deletionRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

initDatabase();

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'customer-data-deletion-api',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/deletion', deletionRoutes);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: '内部服务器错误',
    message: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '路由不存在',
    message: `请求的路由 ${req.method} ${req.path} 不存在`
  });
});

app.listen(PORT, () => {
  console.log(`客户数据删除 API 服务已启动`);
  console.log(`端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API 基础路径: http://localhost:${PORT}/api/deletion`);
  console.log(`\n支持的端点:`);
  console.log(`  POST /api/deletion/requests - 创建删除请求`);
  console.log(`  GET  /api/deletion/requests - 查询所有/客户删除请求`);
  console.log(`  GET  /api/deletion/requests/:id - 查询单个请求详情`);
  console.log(`  GET  /api/deletion/requests/:id/scan - 扫描客户数据`);
  console.log(`  POST /api/deletion/requests/:id/analyze - 分析删除 eligibility`);
  console.log(`  POST /api/deletion/requests/:id/execute - 执行删除`);
  console.log(`  POST /api/deletion/requests/:id/complete - 完成并生成证明`);
  console.log(`  GET  /api/deletion/certificates/:id - 查询删除证明`);
  console.log(`  GET  /api/deletion/compliance/dashboard - 合规仪表板`);
});
