const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');

const { initTables } = require('./config/initDatabase');

const ordersRoutes = require('./routes/orders');
const paymentsRoutes = require('./routes/payments');
const idempotencyRoutes = require('./routes/idempotency');
const reportsRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Idempotency API Demo Service is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '接口幂等性演示服务',
    endpoints: {
      orders: '/api/orders',
      payments: '/api/payments',
      payments_callback: '/api/payments/callback',
      idempotency_records: '/api/idempotency',
      reports: '/api/reports',
      health: '/health'
    },
    documentation: {
      info: '请查看 README.md 获取详细使用说明',
      idempotency_key_header: 'X-Idempotency-Key',
      important_notice: '所有 POST 请求需要提供幂等键 (X-Idempotency-Key)'
    }
  });
});

app.use('/api/orders', ordersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/idempotency', idempotencyRoutes);
app.use('/api/reports', reportsRoutes);

app.use((err, req, res, next) => {
  console.error('未处理的错误:', err);
  
  res.status(err.status || 500).json({
    success: false,
    code: err.code || 'INTERNAL_ERROR',
    message: err.message || 'Internal Server Error'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: 'API endpoint not found'
  });
});

async function startServer() {
  try {
    console.log('正在初始化数据库...');
    initTables();
    console.log('数据库初始化完成');

    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`   接口幂等性演示服务已启动`);
      console.log(`========================================`);
      console.log(`\n服务地址: http://localhost:${PORT}`);
      console.log(`\nAPI 端点:`);
      console.log(`  GET  /health                 - 健康检查`);
      console.log(`  GET  /                       - 根路径`);
      console.log(`\n  POST /api/orders             - 创建订单 (需要幂等键)`);
      console.log(`  GET  /api/orders             - 订单列表`);
      console.log(`  GET  /api/orders/:id         - 订单详情`);
      console.log(`\n  POST /api/payments           - 提交扣款 (需要幂等键)`);
      console.log(`  POST /api/payments/callback  - 支付回调 (需要幂等键)`);
      console.log(`  GET  /api/payments           - 交易列表`);
      console.log(`\n  GET  /api/idempotency        - 幂等记录列表`);
      console.log(`  GET  /api/idempotency/:key   - 幂等记录详情`);
      console.log(`  GET  /api/idempotency/stats/summary - 统计汇总`);
      console.log(`  GET  /api/idempotency/logs/audit     - 审计日志`);
      console.log(`  GET  /api/idempotency/callbacks      - 回调事件列表`);
      console.log(`\n  GET  /api/reports/json       - JSON 报告导出`);
      console.log(`  GET  /api/reports/markdown   - Markdown 报告导出`);
      console.log(`  GET  /api/reports/stats      - 统计数据`);
      console.log(`\n========================================`);
      console.log(`重要提示: 所有 POST 请求需要在 Header 中提供 X-Idempotency-Key`);
      console.log(`示例: curl -H "X-Idempotency-Key: my-unique-key" ...`);
      console.log(`========================================\n`);
    });
  } catch (error) {
    console.error('服务启动失败:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
