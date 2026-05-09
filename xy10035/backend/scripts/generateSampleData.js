const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3001/api';

const services = ['order-service', 'user-service', 'payment-service', 'notification-service', 'gateway-service'];
const operations = ['CREATE', 'UPDATE', 'DELETE', 'QUERY', 'VALIDATE', 'PROCESS', 'SEND', 'CACHE_HIT', 'CACHE_MISS', 'DB_UPDATE'];

function generateTimestamp(baseTime, offsetMs) {
  return new Date(baseTime + offsetMs).toISOString();
}

function generateNormalOrderFlow(userId) {
  const traceId = uuidv4();
  const baseTime = Date.now() - Math.random() * 86400000;
  let offset = 0;

  const logs = [];

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, offset += 0),
    level: 'INFO',
    source: 'web',
    service: 'gateway-service',
    operation: 'START',
    message: '用户请求开始',
    userId,
    status: 'START'
  });

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, offset += 50),
    level: 'INFO',
    source: 'gateway',
    service: 'gateway-service',
    operation: 'VALIDATE',
    message: '验证用户身份',
    userId,
    status: 'PROCESSING'
  });

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, offset += 120),
    level: 'INFO',
    source: 'user-service',
    service: 'user-service',
    operation: 'QUERY',
    message: '查询用户信息',
    userId,
    details: { userId },
    status: 'SUCCESS',
    duration: 80
  });

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, offset += 80),
    level: 'DEBUG',
    source: 'cache',
    service: 'user-service',
    operation: 'CACHE_HIT',
    message: '用户信息缓存命中',
    userId,
    tags: ['cache'],
    details: { cacheKey: `user:${userId}`, staleTime: 120000 },
    status: 'SUCCESS',
    duration: 5
  });

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, offset += 100),
    level: 'INFO',
    source: 'order-service',
    service: 'order-service',
    operation: 'CREATE',
    message: '创建订单',
    userId,
    details: { orderId: uuidv4(), amount: 999.00 },
    status: 'SUCCESS',
    duration: 150
  });

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, offset += 200),
    level: 'INFO',
    source: 'payment-service',
    service: 'payment-service',
    operation: 'PROCESS',
    message: '处理支付',
    userId,
    details: { paymentMethod: 'credit_card', amount: 999.00 },
    status: 'SUCCESS',
    duration: 350
  });

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, offset += 100),
    level: 'INFO',
    source: 'notification-service',
    service: 'notification-service',
    operation: 'SEND',
    message: '发送订单确认邮件',
    userId,
    tags: ['async'],
    details: { notificationType: 'email', expectedOrder: 1 },
    status: 'SUCCESS',
    duration: 80
  });

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, offset += 50),
    level: 'INFO',
    source: 'gateway-service',
    service: 'gateway-service',
    operation: 'SESSION_END',
    message: '订单创建完成',
    userId,
    status: 'END'
  });

  return logs;
}

function generateDuplicateOperationFlow(userId) {
  const traceId = uuidv4();
  const baseTime = Date.now() - Math.random() * 86400000;
  let offset = 0;

  const logs = [];

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, offset += 0),
    level: 'INFO',
    source: 'web',
    service: 'gateway-service',
    operation: 'START',
    message: '用户请求开始',
    userId,
    status: 'START'
  });

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, offset += 100),
    level: 'INFO',
    source: 'order-service',
    service: 'order-service',
    operation: 'CREATE',
    message: '创建订单（第一次）',
    userId,
    details: { 
      orderId: 'ORD-001', 
      requestBody: { product: 'iPhone', quantity: 1 } 
    },
    status: 'SUCCESS',
    duration: 200
  });

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, offset += 2000),
    level: 'WARN',
    source: 'order-service',
    service: 'order-service',
    operation: 'CREATE',
    message: '创建订单（重复提交）',
    userId,
    details: { 
      orderId: 'ORD-002', 
      requestBody: { product: 'iPhone', quantity: 1 } 
    },
    status: 'SUCCESS',
    duration: 180
  });

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, offset += 100),
    level: 'INFO',
    source: 'gateway-service',
    service: 'gateway-service',
    operation: 'SESSION_END',
    message: '请求结束',
    userId,
    status: 'END'
  });

  return logs;
}

function generateConcurrencyConflictFlow() {
  const traceId = uuidv4();
  const baseTime = Date.now() - Math.random() * 86400000;
  const resourceId = 'PRODUCT-001';

  const logs = [];

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, 0),
    level: 'INFO',
    source: 'user-service',
    service: 'order-service',
    operation: 'UPDATE',
    message: '用户1修改库存',
    userId: 'user-001',
    details: { 
      resourceId,
      beforeQty: 100,
      afterQty: 80
    },
    status: 'SUCCESS',
    duration: 150
  });

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, 200),
    level: 'INFO',
    source: 'user-service',
    service: 'order-service',
    operation: 'UPDATE',
    message: '用户2修改库存（并发冲突）',
    userId: 'user-002',
    details: { 
      resourceId,
      beforeQty: 100,
      afterQty: 90
    },
    status: 'SUCCESS',
    duration: 140
  });

  return logs;
}

function generateAsyncOutOfOrderFlow(userId) {
  const traceId = uuidv4();
  const baseTime = Date.now() - Math.random() * 86400000;

  const logs = [];

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, 0),
    level: 'INFO',
    source: 'notification-service',
    service: 'notification-service',
    operation: 'SEND',
    message: '发送发货通知',
    userId,
    tags: ['async'],
    details: { notificationType: 'shipped', expectedOrder: 2 },
    status: 'SUCCESS',
    duration: 80
  });

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, 100),
    level: 'INFO',
    source: 'notification-service',
    service: 'notification-service',
    operation: 'SEND',
    message: '发送订单确认',
    userId,
    tags: ['async'],
    details: { notificationType: 'confirmed', expectedOrder: 1 },
    status: 'SUCCESS',
    duration: 60
  });

  return logs;
}

function generateCacheStaleFlow(userId) {
  const traceId = uuidv4();
  const baseTime = Date.now() - Math.random() * 86400000;
  const cacheKey = `user:${userId}`;

  const logs = [];

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, 0),
    level: 'INFO',
    source: 'user-service',
    service: 'user-service',
    operation: 'DB_UPDATE',
    message: '更新用户信息到数据库',
    userId,
    tags: ['cache'],
    details: { 
      shouldInvalidateCache: true,
      newVersion: 3,
      cacheKey
    },
    status: 'SUCCESS',
    duration: 100
  });

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, 500),
    level: 'WARN',
    source: 'user-service',
    service: 'user-service',
    operation: 'CACHE_HIT',
    message: '读取到过期缓存',
    userId,
    tags: ['cache'],
    details: { 
      cacheKey,
      cacheVersion: 2,
      staleTime: 600000
    },
    status: 'SUCCESS',
    duration: 5
  });

  return logs;
}

function generateRollbackFailedFlow(userId) {
  const traceId = uuidv4();
  const baseTime = Date.now() - Math.random() * 86400000;

  const logs = [];

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, 0),
    level: 'INFO',
    source: 'payment-service',
    service: 'payment-service',
    operation: 'PROCESS',
    message: '开始支付处理',
    userId,
    details: { orderId: 'ORD-ROLLBACK', amount: 5000 },
    status: 'PROCESSING'
  });

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, 500),
    level: 'ERROR',
    source: 'payment-service',
    service: 'payment-service',
    operation: 'PROCESS',
    message: '支付失败，第三方接口超时',
    userId,
    status: 'FAILED',
    duration: 500
  });

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, 600),
    level: 'ERROR',
    source: 'order-service',
    service: 'order-service',
    operation: 'ROLLBACK',
    message: '订单回滚失败：库存服务不可用',
    userId,
    status: 'FAILED',
    duration: 150
  });

  return logs;
}

function generateErrorFlow(userId) {
  const traceId = uuidv4();
  const baseTime = Date.now() - Math.random() * 86400000;

  const logs = [];

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, 0),
    level: 'INFO',
    source: 'web',
    service: 'gateway-service',
    operation: 'START',
    message: '用户请求开始',
    userId,
    status: 'START'
  });

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, 100),
    level: 'INFO',
    source: 'order-service',
    service: 'order-service',
    operation: 'QUERY',
    message: '查询订单信息',
    userId,
    details: { orderId: 'ORD-ERROR' },
    status: 'PROCESSING'
  });

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, 300),
    level: 'ERROR',
    source: 'order-service',
    service: 'order-service',
    operation: 'QUERY',
    message: '数据库连接失败: Connection refused',
    userId,
    details: { 
      errorCode: 'DB_CONN_FAILED',
      stackTrace: 'at com.example.service.OrderService.queryOrder(OrderService.java:42)'
    },
    status: 'FAILED',
    duration: 200
  });

  logs.push({
    traceId,
    spanId: uuidv4(),
    timestamp: generateTimestamp(baseTime, 350),
    level: 'ERROR',
    source: 'gateway-service',
    service: 'gateway-service',
    operation: 'SESSION_END',
    message: '请求处理失败',
    userId,
    status: 'END'
  });

  return logs;
}

async function sendLogs(logs) {
  try {
    await axios.post(`${API_URL}/logs/ingest`, logs);
    console.log(`Sent ${logs.length} logs`);
  } catch (error) {
    console.error('Error sending logs:', error.message);
  }
}

async function generateAll() {
  console.log('Generating sample data...');
  console.log('API URL:', API_URL);

  for (let i = 1; i <= 10; i++) {
    const logs = generateNormalOrderFlow(`user-${i}`);
    await sendLogs(logs);
    await new Promise(r => setTimeout(r, 100));
  }

  await sendLogs(generateDuplicateOperationFlow('user-11'));
  await new Promise(r => setTimeout(r, 100));

  await sendLogs(generateConcurrencyConflictFlow());
  await new Promise(r => setTimeout(r, 100));

  await sendLogs(generateAsyncOutOfOrderFlow('user-12'));
  await new Promise(r => setTimeout(r, 100));

  await sendLogs(generateCacheStaleFlow('user-13'));
  await new Promise(r => setTimeout(r, 100));

  await sendLogs(generateRollbackFailedFlow('user-14'));
  await new Promise(r => setTimeout(r, 100));

  await sendLogs(generateErrorFlow('user-15'));

  console.log('Done! Sample data generated successfully.');
}

generateAll().catch(console.error);
