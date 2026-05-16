const express = require('express');
const bodyParser = require('body-parser');
const rotationRoutes = require('./routes/rotation');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'webhook-signature-rotation-api'
  });
});

app.use('/api/rotation', rotationRoutes);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    path: req.path
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Webhook签名轮换API服务已启动`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`📊 健康检查: http://localhost:${PORT}/health`);
  console.log(`🔧 API基础路径: http://localhost:${PORT}/api/rotation`);
  console.log(`\n📚 可用接口:`);
  console.log(`  POST   /api/rotation           - 创建轮换任务`);
  console.log(`  GET    /api/rotation           - 查询所有轮换任务`);
  console.log(`  GET    /api/rotation/:id       - 查询单个轮换任务`);
  console.log(`  POST   /api/rotation/:id/advance - 推进状态`);
  console.log(`  POST   /api/rotation/:id/deprecate-old-key - 弃用旧密钥`);
  console.log(`  POST   /api/rotation/:id/complete - 完成轮换`);
  console.log(`  POST   /api/rotation/:id/fail  - 标记失败`);
  console.log(`  POST   /api/rotation/:id/retry - 重试轮换`);
  console.log(`  GET    /api/rotation/:id/report - 生成验签报告`);
  console.log(`  GET    /api/rotation/:id/export - 导出报告`);
  console.log(`  GET    /api/rotation/:id/failed-samples - 查询失败样本`);
  console.log(`  POST   /api/rotation/samples/:sampleId/manual-fix - 人工修正`);
  console.log(`  GET    /api/rotation/samples/:sampleId - 查询样本详情`);
  console.log(`  POST   /api/rotation/verify    - Webhook验签`);
  console.log(`\n`);
});

module.exports = app;