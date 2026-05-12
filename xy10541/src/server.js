const express = require('express');
const cors = require('cors');
const TechnicianService = require('./services/technicianService');
const PartsService = require('./services/partsService');

const ordersRouter = require('./routes/orders');
const techniciansRouter = require('./routes/technicians');
const partsRouter = require('./routes/parts');
const reportsRouter = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

TechnicianService.initializeTechnicians();
PartsService.initializeParts();

app.get('/', (req, res) => {
  res.json({
    name: '家电上门安装预约改约 API',
    version: '1.0.0',
    description: '用于家电安装预约、改约、师傅排班、配件管理和赔付的 API 系统',
    endpoints: {
      orders: '/api/orders',
      technicians: '/api/technicians',
      parts: '/api/parts',
      reports: '/api/reports'
    },
    documentation: '请查看 README.md 获取完整使用说明'
  });
});

app.use('/api/orders', ordersRouter);
app.use('/api/technicians', techniciansRouter);
app.use('/api/parts', partsRouter);
app.use('/api/reports', reportsRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    errorCode: 'INTERNAL_ERROR',
    message: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    errorCode: 'NOT_FOUND'
  });
});

app.listen(PORT, () => {
  console.log(`家电安装 API 服务已启动: http://localhost:${PORT}`);
  console.log(`API 基础路径: http://localhost:${PORT}/api`);
  console.log('');
  console.log('可用端点:');
  console.log('  GET  /api/orders                  - 订单列表');
  console.log('  POST /api/orders                  - 创建订单');
  console.log('  GET  /api/orders/:id              - 订单详情');
  console.log('  POST /api/orders/:id/assign-technician  - 分配师傅');
  console.log('  POST /api/orders/:id/allocate-parts     - 分配配件');
  console.log('  POST /api/orders/:id/send-confirmation  - 发送确认');
  console.log('  POST /api/orders/:id/confirm            - 确认预约');
  console.log('  POST /api/orders/:id/reschedule         - 申请改约');
  console.log('  POST /api/orders/:id/start              - 开始服务');
  console.log('  POST /api/orders/:id/complete           - 完成订单');
  console.log('  POST /api/orders/:id/cancel             - 取消订单');
  console.log('  GET  /api/orders/:id/report             - 订单报告');
  console.log('  GET  /api/technicians            - 师傅列表');
  console.log('  GET  /api/parts                  - 配件库存');
  console.log('  GET  /api/reports/dashboard      - 汇总报表');
});
