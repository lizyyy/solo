const express = require('express');
const path = require('path');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`
================================================
驿站包裹追踪服务已启动
服务地址: http://localhost:${PORT}
健康检查: http://localhost:${PORT}/health
API 文档:
  POST /api/batches          - 新增批次
  POST /api/packages         - 新增包裹
  GET  /api/packages/search  - 搜索包裹（支持 pick_up_code, receiver_name, return_batch_id, status）
  GET  /api/packages/code/:code - 按取件码查详情
  POST /api/packages/:id/process - 标记处理（action: pick/return/returning）
  PUT  /api/packages/:id/return  - 修改退回信息
  POST /api/import/csv       - 导入包裹CSV
  POST /api/import/sms       - 导入短信JSON
  GET  /api/export/csv       - 导出CSV
  GET  /api/rules/return     - 获取退回规则
================================================
  `);
});

module.exports = app;
