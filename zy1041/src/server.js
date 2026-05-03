const express = require('express');
const cors = require('cors');

const requestsRouter = require('./routes/requests');
const tripsRouter = require('./routes/trips');
const matchingRouter = require('./routes/matching');
const ordersRouter = require('./routes/orders');
const auditRouter = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/requests', requestsRouter);
app.use('/api/trips', tripsRouter);
app.use('/api/matching', matchingRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/audit', auditRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: 'API接口不存在'
  });
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 顺路带物 API 服务已启动                              ║
║                                                            ║
║   服务地址: http://localhost:${PORT}                          ║
║                                                            ║
║   可用API接口:                                              ║
║   GET  /health                     - 健康检查              ║
║                                                            ║
║   POST /api/requests              - 创建请求单            ║
║   GET  /api/requests              - 获取请求单列表        ║
║   GET  /api/requests/:id          - 获取单个请求单        ║
║                                                            ║
║   POST /api/trips                 - 创建行程              ║
║   GET  /api/trips                 - 获取行程列表          ║
║   GET  /api/trips/:id             - 获取单个行程          ║
║                                                            ║
║   GET  /api/matching/score        - 计算匹配分数          ║
║   GET  /api/matching/request/:id  - 为请求单匹配行程      ║
║   GET  /api/matching/trip/:id     - 为行程匹配请求单      ║
║                                                            ║
║   POST /api/orders/lock           - 锁定订单(接单)        ║
║   POST /api/orders/confirm        - 确认订单              ║
║   POST /api/orders/pickup         - 标记取到物品          ║
║   POST /api/orders/deliver        - 标记送达              ║
║   POST /api/orders/cancel         - 取消订单              ║
║   POST /api/orders/dispute        - 发起争议              ║
║   GET  /api/orders/:order_id      - 获取订单状态          ║
║                                                            ║
║   GET  /api/audit/request/:id     - 获取审计日志          ║
║   GET  /api/audit/request/:id/markdown - 导出Markdown日报 ║
║   GET  /api/audit/daily-report    - 导出今日所有日报      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);
});
