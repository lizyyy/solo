const express = require('express');
const bodyParser = require('body-parser');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({
    name: '水站桶押金流转API服务',
    version: '1.0.0',
    description: '提供桶装水配送站桶押金流转管理功能',
    endpoints: {
      health: 'GET /api/health - 健康检查',
      customers: 'POST /api/customers - 创建客户, GET /api/customers - 客户列表',
      delivery_orders: 'POST /api/delivery-orders - 创建配送单, GET /api/delivery-orders/:id - 配送单详情',
      return_records: 'POST /api/return-records - 创建退桶记录',
      buckets: 'GET /api/buckets - 桶列表',
      status_history: 'GET /api/status-history/:entityType/:entityId - 状态历史',
      exceptions: 'GET /api/exceptions - 异常列表, PUT /api/exceptions/:id - 处理异常',
      manual_corrections: 'POST /api/manual-corrections - 人工修正',
      reports: 'GET /api/reports/deposit - 押金报表, GET /api/reports/deposit/export - 导出押金报表'
    }
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: '服务器内部错误',
    error: err.message 
  });
});

app.listen(PORT, () => {
  console.log(`
=============================================
    水站桶押金流转API服务已启动
=============================================
    服务地址: http://localhost:${PORT}
    健康检查: http://localhost:${PORT}/api/health
=============================================
  `);
});

module.exports = app;
