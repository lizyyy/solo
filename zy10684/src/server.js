const express = require('express');
const bodyParser = require('body-parser');
const rescheduleRoutes = require('./routes/rescheduleRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use('/api/reschedule', rescheduleRoutes);

app.get('/health', (req, res) => {
  res.json({
    code: 0,
    message: '服务正常',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`预约挂号中台改约 API 服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(``);
  console.log(`API 端点:`);
  console.log(`  POST /api/reschedule/batches          - 创建改约批次`);
  console.log(`  POST /api/reschedule/batches/:id/submit - 提交批次`);
  console.log(`  POST /api/reschedule/batches/:id/cancel - 撤回批次`);
  console.log(`  POST /api/reschedule/batches/:id/notify - 发送通知`);
  console.log(`  POST /api/reschedule/batches/:id/refund - 办理退款`);
  console.log(`  POST /api/reschedule/batches/:id/reschedule - 执行改约`);
  console.log(`  GET  /api/reschedule/batches          - 批次列表`);
  console.log(`  GET  /api/reschedule/batches/:id      - 批次详情`);
  console.log(`  GET  /api/reschedule/batches/:id/records - 批次记录`);
  console.log(`  GET  /api/reschedule/batches/:id/export - 导出CSV`);
  console.log(`  GET  /api/reschedule/history          - 操作历史`);
});

module.exports = app;
