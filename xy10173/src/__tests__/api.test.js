const fs = require('fs');
const path = require('path');
const request = require('supertest');

const testDbDir = path.join(__dirname, '../../data-test');
const testDbPath = path.join(testDbDir, 'api-test.db');

function resetModules() {
  const modulesToDelete = [
    '../config/database',
    '../database/schema',
    '../repositories/MemberRepository',
    '../repositories/PointLedgerRepository',
    '../repositories/FreezeBucketRepository',
    '../repositories/FreezeRuleRepository',
    '../repositories/BalanceSnapshotRepository',
    '../repositories/IdempotencyRepository',
    '../services/BalanceService',
    '../services/PointService',
    '../errors/ApiError',
    '../routes/members',
    '../routes/points',
    '../app'
  ];
  modulesToDelete.forEach(m => {
    try { delete require.cache[require.resolve(m)]; } catch(e) {}
  });
}

let app;

beforeEach(() => {
  if (fs.existsSync(testDbDir)) {
    fs.readdirSync(testDbDir).forEach(f => fs.unlinkSync(path.join(testDbDir, f)));
  } else {
    fs.mkdirSync(testDbDir, { recursive: true });
  }
  process.env.DB_PATH = testDbPath;
  resetModules();
  app = require('../app');
});

afterAll(() => {
  if (fs.existsSync(testDbDir)) {
    fs.readdirSync(testDbDir).forEach(f => fs.unlinkSync(path.join(testDbDir, f)));
    fs.rmdirSync(testDbDir);
  }
});

describe('API - 会员管理', () => {
  test('GET /health 返回健康状态', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });

  test('POST /api/v1/members 创建会员', async () => {
    const res = await request(app)
      .post('/api/v1/members')
      .send({ name: 'API测试用户' });
    
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('API测试用户');
  });
});

describe('API - 核心接口', () => {
  let memberId;
  
  beforeEach(async () => {
    const memberRes = await request(app)
      .post('/api/v1/members')
      .send({ name: '接口测试用户' });
    memberId = memberRes.body.data.id;
    
    await request(app).post('/api/v1/points/rules').send({
      code: 'API_RULE',
      name: 'API测试规则',
      releaseType: 'MANUAL'
    });
  });

  test('POST recharge + GET balance', async () => {
    await request(app)
      .post(`/api/v1/points/${memberId}/recharge`)
      .set('X-Request-Id', 'api-recharge-001')
      .set('X-Operator-Name', 'test_user')
      .set('X-Operator-Id', 'op-001')
      .set('X-Operator-Type', 'manual')
      .send({ amount: 5000, reason: 'API充值' });
    
    const balanceRes = await request(app)
      .get(`/api/v1/points/${memberId}/balance`);
    
    expect(balanceRes.body.success).toBe(true);
    expect(balanceRes.body.data.balance.totalBalance).toBe(5000);
    expect(balanceRes.body.data.balance.availableBalance).toBe(5000);
    expect(balanceRes.body.data.consistency.isConsistent).toBe(true);
  });

  test('POST freeze 后 balance 变化', async () => {
    await request(app)
      .post(`/api/v1/points/${memberId}/recharge`)
      .set('X-Request-Id', 'api-recharge-002')
      .send({ amount: 10000 });
    
    const freezeRes = await request(app)
      .post(`/api/v1/points/${memberId}/freeze`)
      .set('X-Request-Id', 'api-freeze-001')
      .send({ amount: 3000, freezeRuleCode: 'API_RULE', reason: 'API风控' });
    
    expect(freezeRes.statusCode).toBe(200);
    expect(freezeRes.body.success).toBe(true);
    expect(freezeRes.body.data.result.balance.freezeBalance).toBe(3000);
    expect(freezeRes.body.data.result.balance.availableBalance).toBe(7000);
  });

  test('POST consume 可用余额不足时（不允许冻结）返回 INSUFFICIENT_BALANCE', async () => {
    await request(app)
      .post(`/api/v1/points/${memberId}/recharge`)
      .set('X-Request-Id', 'api-recharge-003')
      .send({ amount: 1000 });
    
    const res = await request(app)
      .post(`/api/v1/points/${memberId}/consume`)
      .set('X-Request-Id', 'api-consume-001')
      .send({ amount: 3000, allowFreeze: false });
    
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');
  });

  test('POST refund 退款后余额恢复', async () => {
    await request(app)
      .post(`/api/v1/points/${memberId}/recharge`)
      .set('X-Request-Id', 'api-recharge-004')
      .send({ amount: 10000 });
    
    await request(app)
      .post(`/api/v1/points/${memberId}/consume`)
      .set('X-Request-Id', 'api-consume-002')
      .send({ amount: 3000, refId: 'API-ORD-001' });
    
    await request(app)
      .post(`/api/v1/points/${memberId}/refund`)
      .set('X-Request-Id', 'api-refund-001')
      .send({ amount: 3000, refId: 'API-ORD-001', reason: '取消订单' });
    
    const balanceRes = await request(app)
      .get(`/api/v1/points/${memberId}/balance`);
    
    expect(balanceRes.body.data.balance.totalBalance).toBe(10000);
    expect(balanceRes.body.data.balance.availableBalance).toBe(10000);
  });

  test('重复请求（相同 X-Request-Id）幂等拦截', async () => {
    await request(app)
      .post(`/api/v1/points/${memberId}/recharge`)
      .set('X-Request-Id', 'idempotent-test-001')
      .send({ amount: 1000 });
    
    await request(app)
      .post(`/api/v1/points/${memberId}/recharge`)
      .set('X-Request-Id', 'idempotent-test-001')
      .send({ amount: 1000 });
    
    const balanceRes = await request(app)
      .get(`/api/v1/points/${memberId}/balance`);
    
    expect(balanceRes.body.data.balance.totalBalance).toBe(1000);
  });

  test('GET ledgers 返回完整流水', async () => {
    await request(app)
      .post(`/api/v1/points/${memberId}/recharge`)
      .set('X-Request-Id', 'ledger-test-001')
      .send({ amount: 1000 });
    
    await request(app)
      .post(`/api/v1/points/${memberId}/consume`)
      .set('X-Request-Id', 'ledger-test-002')
      .send({ amount: 300 });
    
    const res = await request(app)
      .get(`/api/v1/points/${memberId}/ledgers`);
    
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    
    const rechargeTx = res.body.data.find(t => t.trans_type === 'recharge');
    const consumeTx = res.body.data.find(t => t.trans_type === 'consume');
    
    expect(rechargeTx.status).toBe('SUCCESS');
    expect(consumeTx.status).toBe('SUCCESS');
    expect(consumeTx.balance_before).toBe(1000);
    expect(consumeTx.balance_after).toBe(700);
  });

  test('GET snapshot 创建快照', async () => {
    await request(app)
      .post(`/api/v1/points/${memberId}/recharge`)
      .set('X-Request-Id', 'snapshot-test-001')
      .send({ amount: 5000 });
    
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/v1/points/${memberId}/snapshot/${today}`);
    
    expect(res.body.success).toBe(true);
    expect(res.body.data.snapshot.total_balance).toBe(5000);
    expect(res.body.data.consistency.isConsistent).toBe(true);
  });
});
