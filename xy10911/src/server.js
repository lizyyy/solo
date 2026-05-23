const express = require('express');
const refundRoutes = require('./routes/refundRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '自助洗衣异常退款 API 服务运行正常',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/refunds', refundRoutes);

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: '服务器内部错误'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: '请求的资源不存在'
  });
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`自助洗衣异常退款 API 服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API 基础路径: http://localhost:${PORT}/api/refunds`);
  console.log(`========================================\n`);
  console.log('API 接口列表:');
  console.log('  POST   /api/refunds              - 创建退款申请');
  console.log('  GET    /api/refunds              - 查询退款列表');
  console.log('  GET    /api/refunds/export       - 导出退款数据');
  console.log('  GET    /api/refunds/:refundId    - 查询单条退款');
  console.log('  PUT    /api/refunds/:refundId/status - 更新退款状态');
  console.log('  PATCH  /api/refunds/:refundId/correct - 人工修正');
  console.log('  GET    /api/refunds/:refundId/logs - 查询处理日志');
  console.log('  POST   /api/refunds/:refundId/exception - 记录异常');
  console.log(`\n`);
});
