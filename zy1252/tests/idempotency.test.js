const request = require('supertest');
const { v4: uuidv4 } = require('uuid');
const { initTables, dropTables } = require('../src/config/initDatabase');

let app;

beforeAll(async () => {
  await dropTables();
  await initTables();
  app = require('../src/index');
});

afterAll(async () => {
  const db = require('../src/config/database');
  await db.close();
});

describe('健康检查', () => {
  test('GET /health 应该返回 200', async () => {
    const response = await request(app).get('/health');
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Idempotency API Demo Service is running');
  });

  test('GET / 应该返回服务信息', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.endpoints).toBeDefined();
  });
});

describe('幂等键验证中间件', () => {
  test('没有幂等键应该返回 400 错误', async () => {
    const response = await request(app)
      .post('/api/orders')
      .send({
        user_id: 'user-test-001',
        product_name: '测试商品',
        amount: 99.99
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(response.body.risk_warning).toBe(true);
  });

  test('无幂等键时应该返回风险提示', async () => {
    const response = await request(app)
      .post('/api/orders')
      .send({
        user_id: 'user-test-001',
        product_name: '测试商品',
        amount: 99.99
      });

    expect(response.body.hint).toBeDefined();
    expect(response.body.hint).toContain('X-Idempotency-Key');
  });
});

describe('创建订单 - 幂等性测试', () => {
  test('第一次创建订单应该成功', async () => {
    const idempotencyKey = `test-order-${uuidv4().substring(0, 8)}`;
    
    const response = await request(app)
      .post('/api/orders')
      .set('X-Idempotency-Key', idempotencyKey)
      .send({
        user_id: 'user-test-002',
        product_name: 'iPhone 15 Pro',
        amount: 7999.00
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.code).toBe('ORDER_CREATED');
    expect(response.body.data.order.id).toBeDefined();
    
    global.createdOrderId = response.body.data.order.id;
    global.firstOrderIdempotencyKey = idempotencyKey;
  });

  test('使用相同幂等键重复请求应该返回缓存响应 (idempotency_hit)', async () => {
    const response = await request(app)
      .post('/api/orders')
      .set('X-Idempotency-Key', global.firstOrderIdempotencyKey)
      .send({
        user_id: 'user-test-002',
        product_name: 'iPhone 15 Pro',
        amount: 7999.00
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.idempotency_hit).toBe(true);
    expect(response.body.cached_response).toBe(true);
    expect(response.body.data.order.id).toBe(global.createdOrderId);
  });

  test('同一幂等键不同参数应该返回 409 冲突', async () => {
    const idempotencyKey = `test-conflict-${uuidv4().substring(0, 8)}`;
    
    await request(app)
      .post('/api/orders')
      .set('X-Idempotency-Key', idempotencyKey)
      .send({
        user_id: 'user-test-003',
        product_name: '商品A',
        amount: 100.00
      });

    const response = await request(app)
      .post('/api/orders')
      .set('X-Idempotency-Key', idempotencyKey)
      .send({
        user_id: 'user-test-003',
        product_name: '商品B',
        amount: 200.00
      });

    expect(response.statusCode).toBe(409);
    expect(response.body.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(response.body.message).toContain('conflict');
  });
});

describe('支付扣款 - 幂等性测试', () => {
  let orderId;
  const paymentIdempotencyKey = `test-payment-${uuidv4().substring(0, 8)}`;

  beforeAll(async () => {
    const orderResponse = await request(app)
      .post('/api/orders')
      .set('X-Idempotency-Key', `order-for-payment-${uuidv4().substring(0, 8)}`)
      .send({
        user_id: 'user-test-payment',
        product_name: 'MacBook Pro',
        amount: 12999.00
      });
    
    orderId = orderResponse.body.data.order.id;
  });

  test('提交扣款应该成功', async () => {
    const response = await request(app)
      .post('/api/payments')
      .set('X-Idempotency-Key', paymentIdempotencyKey)
      .send({
        order_id: orderId,
        payment_method: 'alipay',
        amount: 12999.00
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.code).toBe('PAYMENT_SUCCESS');
    expect(response.body.data.transaction.status).toBe('success');
    
    global.paymentIdempotencyKey = paymentIdempotencyKey;
  });

  test('重复提交扣款应该返回缓存响应', async () => {
    const response = await request(app)
      .post('/api/payments')
      .set('X-Idempotency-Key', global.paymentIdempotencyKey)
      .send({
        order_id: orderId,
        payment_method: 'alipay',
        amount: 12999.00
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.idempotency_hit).toBe(true);
    expect(response.body.cached_response).toBe(true);
  });

  test('金额不匹配应该返回错误', async () => {
    const tempOrderResponse = await request(app)
      .post('/api/orders')
      .set('X-Idempotency-Key', `temp-order-${uuidv4().substring(0, 8)}`)
      .send({
        user_id: 'user-test-mismatch',
        product_name: 'iPad',
        amount: 5000.00
      });

    const response = await request(app)
      .post('/api/payments')
      .set('X-Idempotency-Key', `payment-mismatch-${uuidv4().substring(0, 8)}`)
      .send({
        order_id: tempOrderResponse.body.data.order.id,
        payment_method: 'wechat',
        amount: 1000.00
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe('AMOUNT_MISMATCH');
  });
});

describe('支付回调 - 幂等性测试', () => {
  let orderId;
  let gatewayTransactionId;
  const callbackIdempotencyKey = `test-callback-${uuidv4().substring(0, 8)}`;

  beforeAll(async () => {
    const orderResponse = await request(app)
      .post('/api/orders')
      .set('X-Idempotency-Key', `order-for-callback-${uuidv4().substring(0, 8)}`)
      .send({
        user_id: 'user-test-callback',
        product_name: 'AirPods Pro',
        amount: 1899.00
      });
    
    orderId = orderResponse.body.data.order.id;

    const paymentResponse = await request(app)
      .post('/api/payments')
      .set('X-Idempotency-Key', `payment-for-callback-${uuidv4().substring(0, 8)}`)
      .send({
        order_id: orderId,
        payment_method: 'alipay',
        amount: 1899.00
      });

    gatewayTransactionId = paymentResponse.body.data.transaction.gateway_transaction_id;
  });

  test('第一次支付回调应该成功处理', async () => {
    const response = await request(app)
      .post('/api/payments/callback')
      .set('X-Idempotency-Key', callbackIdempotencyKey)
      .send({
        gateway_transaction_id: gatewayTransactionId,
        order_id: orderId,
        status: 'success',
        amount: 1899.00
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.code === 'CALLBACK_PROCESSED' || response.body.code === 'CALLBACK_DUPLICATE').toBe(true);
    
    global.callbackIdempotencyKey = callbackIdempotencyKey;
  });

  test('重复支付回调应该返回已处理 (duplicate)', async () => {
    const response = await request(app)
      .post('/api/payments/callback')
      .set('X-Idempotency-Key', global.callbackIdempotencyKey)
      .send({
        gateway_transaction_id: gatewayTransactionId,
        order_id: orderId,
        status: 'success',
        amount: 1899.00
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.idempotency_hit).toBe(true);
  });
});

describe('幂等记录查询接口', () => {
  test('GET /api/idempotency 应该返回幂等记录列表', async () => {
    const response = await request(app).get('/api/idempotency');
    
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.records).toBeDefined();
    expect(response.body.data.pagination).toBeDefined();
  });

  test('GET /api/idempotency/stats/summary 应该返回统计数据', async () => {
    const response = await request(app).get('/api/idempotency/stats/summary');
    
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.summary).toBeDefined();
    expect(response.body.data.statistics).toBeDefined();
  });

  test('GET /api/idempotency/logs/audit 应该返回审计日志', async () => {
    const response = await request(app).get('/api/idempotency/logs/audit');
    
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.logs).toBeDefined();
  });
});

describe('报告导出接口', () => {
  test('GET /api/reports/stats 应该返回统计报告', async () => {
    const response = await request(app).get('/api/reports/stats');
    
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
  });

  test('GET /api/reports/json 应该返回 JSON 报告', async () => {
    const response = await request(app).get('/api/reports/json');
    
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body.generated_at).toBeDefined();
  });

  test('GET /api/reports/markdown 应该返回 Markdown 报告', async () => {
    const response = await request(app).get('/api/reports/markdown');
    
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('markdown');
    expect(response.text).toContain('# 接口幂等性演示服务');
  });
});

describe('订单查询接口', () => {
  test('GET /api/orders 应该返回订单列表', async () => {
    const response = await request(app).get('/api/orders');
    
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.orders).toBeDefined();
  });

  test('GET /api/orders/:id 应该返回订单详情', async () => {
    const response = await request(app).get(`/api/orders/${global.createdOrderId}`);
    
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.order.id).toBe(global.createdOrderId);
  });
});

describe('支付查询接口', () => {
  test('GET /api/payments 应该返回交易列表', async () => {
    const response = await request(app).get('/api/payments');
    
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.transactions).toBeDefined();
  });
});
