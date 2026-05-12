const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const orderService = require('./order-service');
const store = require('./data-store');

const app = express();
const PORT = 3001;

app.use(bodyParser.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

function responseWrapper(result, res) {
  if (result.success) {
    return res.status(200).json({
      success: true,
      data: result.data,
      isDuplicate: result.isDuplicate || false
    });
  } else {
    return res.status(400).json({
      success: false,
      error: result.error,
      errorCode: result.errorCode
    });
  }
}

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'running',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  });
});

app.get('/api/tickets', (req, res) => {
  res.json({ success: true, data: store.tickets });
});

app.get('/api/ferry-classes', (req, res) => {
  const { status } = req.query;
  let ferries = store.ferryClasses;
  if (status) {
    ferries = ferries.filter(f => f.status === status);
  }
  res.json({ success: true, data: ferries });
});

app.post('/api/orders', (req, res) => {
  const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotencyKey;
  const result = orderService.createOrder(req.body, idempotencyKey);
  responseWrapper(result, res);
});

app.get('/api/orders/:id', (req, res) => {
  const result = orderService.getOrder(req.params.id);
  responseWrapper(result, res);
});

app.get('/api/orders/:id/history', (req, res) => {
  const result = orderService.getOrderHistory(req.params.id);
  responseWrapper(result, res);
});

app.post('/api/orders/:id/validate', (req, res) => {
  const { segment, operator } = req.body;
  const idempotencyKey = req.headers['x-idempotency-key'];
  const result = orderService.validateSegment(req.params.id, segment, operator || 'staff', idempotencyKey);
  responseWrapper(result, res);
});

app.get('/api/orders/:id/rebook-options', (req, res) => {
  const result = orderService.getAvailableRebookClasses(req.params.id);
  responseWrapper(result, res);
});

app.post('/api/orders/:id/rebook', (req, res) => {
  const { newFerryClassId, reason, operator } = req.body;
  const idempotencyKey = req.headers['x-idempotency-key'];
  const result = orderService.rebook(
    req.params.id,
    newFerryClassId,
    reason || '用户主动改签',
    operator || 'staff',
    idempotencyKey
  );
  responseWrapper(result, res);
});

app.post('/api/orders/:id/refund', (req, res) => {
  const { refundType, operator } = req.body;
  const idempotencyKey = req.headers['x-idempotency-key'];
  const result = orderService.processRefund(
    req.params.id,
    refundType,
    operator || 'staff',
    idempotencyKey
  );
  responseWrapper(result, res);
});

app.post('/api/ferry-classes/:id/suspend', (req, res) => {
  const { reason, operator } = req.body;
  const result = orderService.suspendFerryClass(
    req.params.id,
    reason || '天气原因',
    operator || 'admin'
  );
  responseWrapper(result, res);
});

app.post('/api/orders/:id/manual-correct', (req, res) => {
  const { field, beforeValue, afterValue, operator, reason } = req.body;
  if (!field || beforeValue === undefined || afterValue === undefined || !operator || !reason) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数: field, beforeValue, afterValue, operator, reason',
      errorCode: 'MISSING_PARAMS'
    });
  }
  const result = orderService.manualCorrect(
    req.params.id,
    field,
    beforeValue,
    afterValue,
    operator,
    reason
  );
  responseWrapper(result, res);
});

app.get('/api/report', (req, res) => {
  const result = orderService.generateReport();
  responseWrapper(result, res);
});

app.get('/api/audit-logs', (req, res) => {
  const { recordId } = req.query;
  const result = orderService.getAuditLogs(recordId);
  responseWrapper(result, res);
});

function initializeSampleData() {
  const ticket1 = store.createTicket({
    scenicSpotId: 'spot001',
    name: '千岛湖景区门票',
    price: 150,
    description: '包含景区主游览区',
    validFrom: new Date().toISOString(),
    validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    stock: 100
  });

  const ticket2 = store.createTicket({
    scenicSpotId: 'spot001',
    name: '千岛湖景区门票(学生票)',
    price: 75,
    description: '凭有效学生证件',
    validFrom: new Date().toISOString(),
    validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    stock: 50
  });

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const ferry1 = store.createFerryClass({
    route: '码头A -> 中心岛',
    departureTime: '08:30',
    arrivalTime: '09:00',
    vesselName: '明珠号',
    capacity: 50,
    price: 60,
    date: today
  });

  const ferry2 = store.createFerryClass({
    route: '码头A -> 中心岛',
    departureTime: '10:00',
    arrivalTime: '10:30',
    vesselName: '明珠号',
    capacity: 50,
    price: 60,
    date: today
  });

  const ferry3 = store.createFerryClass({
    route: '码头A -> 中心岛',
    departureTime: '14:00',
    arrivalTime: '14:30',
    vesselName: '翡翠号',
    capacity: 80,
    price: 60,
    date: today
  });

  const ferry4 = store.createFerryClass({
    route: '码头A -> 中心岛',
    departureTime: '09:00',
    arrivalTime: '09:30',
    vesselName: '翡翠号',
    capacity: 80,
    price: 60,
    date: tomorrow
  });

  const ferry5 = store.createFerryClass({
    route: '码头A -> 西南湖区',
    departureTime: '13:00',
    arrivalTime: '13:45',
    vesselName: '星耀号',
    capacity: 100,
    price: 80,
    date: today
  });

  const ferry6 = store.createFerryClass({
    route: '码头A -> 中心岛',
    departureTime: '16:00',
    arrivalTime: '16:30',
    vesselName: '明珠号',
    capacity: 50,
    price: 60,
    date: today
  });

  console.log('=== 初始化样例数据完成 ===');
  console.log('门票数据:', store.tickets.length, '条');
  console.log('船班数据:', store.ferryClasses.length, '条');
  console.log('');
  console.log('=== 可用样例门票ID ===');
  store.tickets.forEach((t, i) => console.log(`  [${i}] ${t.name}: ${t.id}`));
  console.log('');
  console.log('=== 可用样例船班ID ===');
  store.ferryClasses.forEach((f, i) => console.log(`  [${i}] ${f.route} ${f.departureTime} (${f.date}): ${f.id}`));
  console.log('');
}

initializeSampleData();

app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`   景区船票联程 API 已启动`);
  console.log(`   地址: http://localhost:${PORT}`);
  console.log(`=================================`);
  console.log('');
  console.log('主要接口:');
  console.log('  GET  /api/health                     - 健康检查');
  console.log('  GET  /api/tickets                    - 门票列表');
  console.log('  GET  /api/ferry-classes              - 船班列表');
  console.log('  POST /api/orders                     - 创建订单');
  console.log('  GET  /api/orders/:id                 - 查询订单');
  console.log('  GET  /api/orders/:id/history         - 订单历史');
  console.log('  POST /api/orders/:id/validate        - 分段核销');
  console.log('  GET  /api/orders/:id/rebook-options  - 可改签班次');
  console.log('  POST /api/orders/:id/rebook          - 改签');
  console.log('  POST /api/orders/:id/refund          - 退款');
  console.log('  POST /api/ferry-classes/:id/suspend  - 停航');
  console.log('  POST /api/orders/:id/manual-correct  - 人工修正');
  console.log('  GET  /api/report                     - 运营报告');
  console.log('  GET  /api/audit-logs                 - 审计日志');
  console.log('');
});
