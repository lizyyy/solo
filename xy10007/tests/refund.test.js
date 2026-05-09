const request = require('supertest');
const app = require('../server');
const { sequelize, Order, Refund, AuditLog, Task } = require('../models');
const { v4: uuidv4 } = require('uuid');

beforeAll(async () => {
  await sequelize.authenticate();
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('Order Management', () => {
  let testOrder;

  test('should create a new order', async () => {
    const response = await request(app)
      .post('/api/orders')
      .send({
        orderNo: 'TEST-ORDER-001',
        userId: 'USER-001',
        amount: 100.00
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.order.orderNo).toBe('TEST-ORDER-001');
    testOrder = response.body.order;
  });

  test('should update order status', async () => {
    const response = await request(app)
      .put(`/api/orders/${testOrder.id}/status`)
      .send({ status: 'paid' });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.order.status).toBe('paid');
  });

  test('should not create duplicate order with same orderNo', async () => {
    const response = await request(app)
      .post('/api/orders')
      .send({
        orderNo: 'TEST-ORDER-001',
        userId: 'USER-002',
        amount: 200.00
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
  });
});

describe('Refund Management', () => {
  let testOrder;
  let testRefund;
  const idempotencyKey = uuidv4();

  beforeAll(async () => {
    const orderResponse = await request(app)
      .post('/api/orders')
      .send({
        orderNo: 'TEST-ORDER-REFUND-001',
        userId: 'USER-002',
        amount: 200.00
      });
    testOrder = orderResponse.body.order;

    await request(app)
      .put(`/api/orders/${testOrder.id}/status`)
      .send({ status: 'paid' });
  });

  test('should create a refund', async () => {
    const response = await request(app)
      .post('/api/refunds')
      .send({
        orderId: testOrder.id,
        amount: 50.00,
        reason: 'Test refund'
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.refund.amount).toBe('50.00');
    testRefund = response.body.refund;
  });

  test('should handle duplicate refund requests with idempotency key', async () => {
    const firstResponse = await request(app)
      .post('/api/refunds')
      .set('x-idempotency-key', idempotencyKey)
      .send({
        orderId: testOrder.id,
        amount: 30.00,
        reason: 'Test idempotent refund'
      });

    expect(firstResponse.statusCode).toBe(201);
    expect(firstResponse.body.success).toBe(true);

    const secondResponse = await request(app)
      .post('/api/refunds')
      .set('x-idempotency-key', idempotencyKey)
      .send({
        orderId: testOrder.id,
        amount: 30.00,
        reason: 'Test idempotent refund'
      });

    expect(secondResponse.statusCode).toBe(201);
    expect(secondResponse.body.success).toBe(true);
    expect(secondResponse.body.isDuplicate).toBe(true);
    expect(secondResponse.body.refund.id).toBe(firstResponse.body.refund.id);
  });

  test('should not create refund with amount exceeding order', async () => {
    const response = await request(app)
      .post('/api/refunds')
      .send({
        orderId: testOrder.id,
        amount: 300.00,
        reason: 'Excessive refund'
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('should approve a refund', async () => {
    const response = await request(app)
      .post(`/api/refunds/${testRefund.id}/approve`)
      .send({ comment: 'Approved for testing' });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.refund.status).toBe('approved');
  });

  test('should create audit log for refund creation', async () => {
    const logs = await AuditLog.findAll({
      where: {
        entityType: 'Refund',
        entityId: testRefund.id,
        action: 'CREATE'
      }
    });

    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe('CREATE');
  });

  test('should create audit log for refund approval', async () => {
    const logs = await AuditLog.findAll({
      where: {
        entityType: 'Refund',
        entityId: testRefund.id,
        action: 'APPROVE'
      }
    });

    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe('APPROVE');
  });
});

describe('Task Management', () => {
  let testOrder;
  let testRefund;

  beforeAll(async () => {
    const orderResponse = await request(app)
      .post('/api/orders')
      .send({
        orderNo: 'TEST-ORDER-TASK-001',
        userId: 'USER-003',
        amount: 150.00
      });
    testOrder = orderResponse.body.order;

    await request(app)
      .put(`/api/orders/${testOrder.id}/status`)
      .send({ status: 'paid' });

    const refundResponse = await request(app)
      .post('/api/refunds')
      .send({
        orderId: testOrder.id,
        amount: 50.00,
        reason: 'Test task refund'
      });
    testRefund = refundResponse.body.refund;

    await request(app)
      .post(`/api/refunds/${testRefund.id}/approve`)
      .send({ comment: 'Approved' });
  });

  test('should queue refund for async execution', async () => {
    const response = await request(app)
      .post(`/api/refunds/${testRefund.id}/execute-async`);

    expect(response.statusCode).toBe(202);
    expect(response.body.success).toBe(true);
    expect(response.body.taskId).toBeDefined();
  });

  test('should list tasks', async () => {
    const response = await request(app)
      .get('/api/tasks');

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.tasks.length).toBeGreaterThan(0);
  });
});

describe('Report Export', () => {
  test('should get statistics', async () => {
    const response = await request(app)
      .get('/api/reports/statistics');

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.statistics.totalRefunds).toBeGreaterThan(0);
    expect(response.body.statistics.totalAmount).toBeGreaterThan(0);
  });

  test('should export refund report', async () => {
    const response = await request(app)
      .get('/api/reports/refunds/export');

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('spreadsheetml');
  });

  test('should export audit report', async () => {
    const response = await request(app)
      .get('/api/reports/audit/export');

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('spreadsheetml');
  });
});

describe('Audit Logs', () => {
  test('should list audit logs', async () => {
    const response = await request(app)
      .get('/api/audit');

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.logs.length).toBeGreaterThan(0);
  });
});