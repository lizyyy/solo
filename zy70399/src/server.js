const express = require('express');
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1', apiRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '内部服务器错误', message: err.message });
});

app.listen(PORT, () => {
  console.log(`服务级降噪通知 API 服务已启动`);
  console.log(`监听端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/v1/health`);
  console.log('');
  console.log('可用 API 端点:');
  console.log('  GET  /api/v1/health                              - 健康检查');
  console.log('  POST /api/v1/services                            - 注册服务');
  console.log('  GET  /api/v1/services                            - 获取所有服务');
  console.log('  POST /api/v1/rules                               - 设置租户规则');
  console.log('  POST /api/v1/notifications                       - 接入通知');
  console.log('  POST /api/v1/notifications/:groupId/confirm      - 确认通知');
  console.log('  POST /api/v1/notifications/:groupId/close        - 关闭通知');
  console.log('  GET  /api/v1/notifications/active                - 获取活跃通知组');
  console.log('  GET  /api/v1/notifications/:groupId             - 获取通知组详情');
  console.log('  GET  /api/v1/history                             - 获取发送历史');
  console.log('  GET  /api/v1/reports/noise-reduction             - 获取降噪报告');
});
