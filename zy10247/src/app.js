const express = require('express');
const { initDatabase } = require('./database');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/api', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '社区车位短租 API 运行正常' });
});

initDatabase();

app.listen(PORT, () => {
  console.log(`
🚀 社区车位短租 API 服务已启动
📍 服务地址: http://localhost:${PORT}
📋 API 文档: http://localhost:${PORT}/api
🔧 健康检查: http://localhost:${PORT}/health

主要接口:
  POST /api/parking-spots - 发布车位
  POST /api/orders - 创建订单
  POST /api/orders/:id/pay - 支付确认
  POST /api/orders/:id/authorize - 门禁授权
  POST /api/orders/:id/cancel - 取消订单
  POST /api/orders/:id/refund - 退款
  GET /api/orders/:id/timeline - 操作时间线
  GET /api/dashboard/stats - 数据汇总
  `);
});

module.exports = app;
