const { v4: uuidv4 } = require('uuid');
const request = require('supertest');
const { initDb, resetDb } = require('../src/db');
const inventoryService = require('../src/services/inventory');
const { app, startServer } = require('../src/index');

function getRandomSku() {
  return `SKU-${uuidv4().substring(0, 8).toUpperCase()}`;
}

describe('API Integration Tests', () => {
  let targetSku;

  beforeAll(() => {
    process.env.DB_PATH = ':memory:';
    initDb();
  });

  beforeEach(() => {
    resetDb();
    targetSku = getRandomSku();
    inventoryService.upsertInventory(targetSku, 100, 100, 0);
  });

  test('GET /api/health should return 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('POST /api/exchanges should require idempotency key', async () => {
    const res = await request(app)
      .post('/api/exchanges')
      .send({
        order_id: 'ORD-TEST-001',
        original_sku: 'SKU-OLD',
        target_sku: targetSku,
        reason: 'test'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe(1002);
  });

  test('POST /api/exchanges should create exchange with idempotency key', async () => {
    const idemKey = `create-${uuidv4()}`;
    const res = await request(app)
      .post('/api/exchanges')
      .set('X-Idempotency-Key', idemKey)
      .send({
        order_id: 'ORD-TEST-002',
        original_sku: 'SKU-OLD',
        target_sku: targetSku,
        reason: 'test'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.code).toBe(0);
    expect(res.body.data.id).toBeDefined();
  });

  test('POST /api/exchanges should be idempotent', async () => {
    const idemKey = `create-idemp-${uuidv4()}`;
    
    const res1 = await request(app)
      .post('/api/exchanges')
      .set('X-Idempotency-Key', idemKey)
      .send({
        order_id: 'ORD-IDEMP-001',
        original_sku: 'SKU-OLD',
        target_sku: targetSku,
        reason: 'test'
      });

    const res2 = await request(app)
      .post('/api/exchanges')
      .set('X-Idempotency-Key', idemKey)
      .send({
        order_id: 'ORD-IDEMP-001',
        original_sku: 'SKU-OLD',
        target_sku: targetSku,
        reason: 'test'
      });

    expect(res1.statusCode).toBe(201);
    expect(res2.statusCode).toBe(200);
    expect(res1.body.data.id).toBe(res2.body.data.id);
    expect(res2.body.from_cache).toBe(true);
  });

  test('GET /api/exchanges should list exchanges', async () => {
    const idemKey = `list-${uuidv4()}`;
    await request(app)
      .post('/api/exchanges')
      .set('X-Idempotency-Key', idemKey)
      .send({
        order_id: 'ORD-LIST-001',
        original_sku: 'SKU-OLD',
        target_sku: targetSku,
        reason: 'test'
      });

    const res = await request(app).get('/api/exchanges');
    expect(res.statusCode).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.length).toBe(1);
  });

  test('GET /api/exchanges/:id should return exchange with next statuses', async () => {
    const idemKey = `get-${uuidv4()}`;
    const createRes = await request(app)
      .post('/api/exchanges')
      .set('X-Idempotency-Key', idemKey)
      .send({
        order_id: 'ORD-GET-001',
        original_sku: 'SKU-OLD',
        target_sku: targetSku,
        reason: 'test'
      });

    const exchangeId = createRes.body.data.id;
    const res = await request(app).get(`/api/exchanges/${exchangeId}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body.data.id).toBe(exchangeId);
    expect(res.body.data.next_allowed_statuses).toBeDefined();
    expect(res.body.data.status_logs).toBeDefined();
  });

  test('full API flow should work', async () => {
    let idemKey = `flow-${uuidv4()}`;
    let res = await request(app)
      .post('/api/exchanges')
      .set('X-Idempotency-Key', idemKey)
      .send({
        order_id: 'ORD-FLOW-001',
        original_sku: 'SKU-OLD',
        target_sku: targetSku,
        reason: '尺码问题'
      });
    const exchangeId = res.body.data.id;
    expect(res.statusCode).toBe(201);

    idemKey = `submit-${uuidv4()}`;
    res = await request(app)
      .post(`/api/exchanges/${exchangeId}/submit`)
      .set('X-Idempotency-Key', idemKey);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('applied');

    idemKey = `ship-${uuidv4()}`;
    res = await request(app)
      .post(`/api/exchanges/${exchangeId}/ship-back`)
      .set('X-Idempotency-Key', idemKey);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('shipped_back');

    idemKey = `qc-${uuidv4()}`;
    res = await request(app)
      .post(`/api/exchanges/${exchangeId}/qc-pass`)
      .set('X-Idempotency-Key', idemKey);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('qc_passed');

    idemKey = `price-${uuidv4()}`;
    res = await request(app)
      .post(`/api/exchanges/${exchangeId}/calculate-price`)
      .set('X-Idempotency-Key', idemKey)
      .send({ price_diff: 3000 });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('need_payment');

    idemKey = `pay-${uuidv4()}`;
    res = await request(app)
      .post(`/api/exchanges/${exchangeId}/pay`)
      .set('X-Idempotency-Key', idemKey)
      .send({ paid_amount: 3000 });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('paid');

    idemKey = `reship-${uuidv4()}`;
    res = await request(app)
      .post(`/api/exchanges/${exchangeId}/reship`)
      .set('X-Idempotency-Key', idemKey);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('reshipping');

    idemKey = `complete-${uuidv4()}`;
    res = await request(app)
      .post(`/api/exchanges/${exchangeId}/complete`)
      .set('X-Idempotency-Key', idemKey);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('completed');
  });

  test('invalid state transition should return error', async () => {
    const idemKey = `invalid-${uuidv4()}`;
    const createRes = await request(app)
      .post('/api/exchanges')
      .set('X-Idempotency-Key', idemKey)
      .send({
        order_id: 'ORD-INVALID-001',
        original_sku: 'SKU-OLD',
        target_sku: targetSku,
        reason: 'test'
      });
    const exchangeId = createRes.body.data.id;

    const res = await request(app)
      .post(`/api/exchanges/${exchangeId}/complete`)
      .set('X-Idempotency-Key', `complete-${uuidv4()}`);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe(1001);
  });

  test('GET /api/exchanges/stats should return statistics', async () => {
    const res = await request(app).get('/api/exchanges/stats');
    expect(res.statusCode).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.exchanges).toBeDefined();
    expect(res.body.data.inventory).toBeDefined();
  });

  test('GET /api/inventory/:sku should return inventory', async () => {
    const res = await request(app).get(`/api/inventory/${targetSku}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.sku).toBe(targetSku);
    expect(res.body.data.total_qty).toBe(100);
  });
});
