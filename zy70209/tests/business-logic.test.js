const request = require('supertest');

let app, server;

beforeAll(async () => {
  process.env.DB_PATH = ':memory:';
  const { startServer } = require('../server');
  const result = await startServer(0);
  app = result.app;
  server = result.server;
});

afterAll(async () => {
  const { closeDb } = require('../db/connection');
  await closeDb();
  server.close();
});

describe('捐赠登记测试', () => {
  test('应该能正常登记捐赠', async () => {
    const res = await request(app)
      .post('/api/donations')
      .send({
        donorId: 'DONOR001',
        donationDate: '2026-05-10',
        quantityMl: 500,
        notes: '首次捐赠'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('pending_test');
    expect(res.body.data.quantity_ml).toBe(500);
  });

  test('缺少必要字段应该返回400错误', async () => {
    const res = await request(app)
      .post('/api/donations')
      .send({
        donorId: 'DONOR002'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('MISSING_FIELDS');
  });

  test('捐赠量必须大于0', async () => {
    const res = await request(app)
      .post('/api/donations')
      .send({
        donorId: 'DONOR003',
        donationDate: '2026-05-10',
        quantityMl: 0
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('INVALID_QUANTITY');
  });
});

describe('检测流程测试', () => {
  let donationId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/donations')
      .send({
        donorId: 'DONOR_TEST',
        donationDate: '2026-05-10',
        quantityMl: 300
      });
    donationId = res.body.data.id;
  });

  test('应该能录入HIV阴性检测结果', async () => {
    const res = await request(app)
      .post('/api/tests')
      .send({
        donationId: donationId,
        testType: 'hiv',
        result: 'negative',
        testDate: '2026-05-10',
        testedBy: 'TESTER001'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('同一捐赠的同一检测类型不能重复录入', async () => {
    const res = await request(app)
      .post('/api/tests')
      .send({
        donationId: donationId,
        testType: 'hiv',
        result: 'positive',
        testDate: '2026-05-10'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.result).toBe('negative');
    expect(res.body.message).toContain('已存在');
  });

  test('无效检测类型应该返回错误', async () => {
    const res = await request(app)
      .post('/api/tests')
      .send({
        donationId: donationId,
        testType: 'invalid_test',
        result: 'negative',
        testDate: '2026-05-10'
      });

    expect(res.statusCode).toBe(400);
  });
});

describe('冻存批次测试', () => {
  let donationId;

  beforeAll(async () => {
    const donationRes = await request(app)
      .post('/api/donations')
      .send({
        donorId: 'DONOR_FREEZE',
        donationDate: '2026-05-10',
        quantityMl: 400
      });
    donationId = donationRes.body.data.id;

    const criticalTests = ['hiv', 'htlv', 'hbsag', 'syphilis', 'bacterial_culture'];
    for (const testType of criticalTests) {
      await request(app)
        .post('/api/tests')
        .send({
          donationId: donationId,
          testType: testType,
          result: 'negative',
          testDate: '2026-05-10'
        });
    }
  });

  test('检测合格后应该能创建冻存批次', async () => {
    const donationCheck = await request(app).get(`/api/donations/${donationId}`);
    expect(donationCheck.body.data.status).toBe('test_passed');

    const res = await request(app)
      .post('/api/batches')
      .send({
        donationId: donationId,
        containerType: 'bag_100ml',
        containerCount: 2,
        freezerLocation: 'FREEZER-A',
        freezerLevel: 'L1'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.batch_code).toBeDefined();
    expect(res.body.data.volume_ml).toBe(200);
  });

  test('不能创建超过捐赠量的批次', async () => {
    const res = await request(app)
      .post('/api/batches')
      .send({
        donationId: donationId,
        containerType: 'bag_200ml',
        containerCount: 3,
        freezerLocation: 'FREEZER-A'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('超出');
  });

  test('检测不合格的捐赠不能冻存', async () => {
    const badDonation = await request(app)
      .post('/api/donations')
      .send({
        donorId: 'DONOR_BAD',
        donationDate: '2026-05-10',
        quantityMl: 100
      });
    const badId = badDonation.body.data.id;

    await request(app)
      .post('/api/tests')
      .send({
        donationId: badId,
        testType: 'hiv',
        result: 'positive',
        testDate: '2026-05-10'
      });

    const res = await request(app)
      .post('/api/batches')
      .send({
        donationId: badId,
        containerType: 'bag_50ml',
        containerCount: 1,
        freezerLocation: 'FREEZER-A'
      });

    expect(res.statusCode).toBe(400);
  });
});

describe('发放核验测试', () => {
  let batchId;

  beforeAll(async () => {
    const donationRes = await request(app)
      .post('/api/donations')
      .send({
        donorId: 'DONOR_DIST',
        donationDate: '2026-05-10',
        quantityMl: 200
      });
    const donationId = donationRes.body.data.id;

    const criticalTests = ['hiv', 'htlv', 'hbsag', 'syphilis', 'bacterial_culture'];
    for (const testType of criticalTests) {
      await request(app)
        .post('/api/tests')
        .send({
          donationId: donationId,
          testType: testType,
          result: 'negative',
          testDate: '2026-05-10'
        });
    }

    const batchRes = await request(app)
      .post('/api/batches')
      .send({
        donationId: donationId,
        containerType: 'bag_100ml',
        containerCount: 2,
        freezerLocation: 'FREEZER-A'
      });
    batchId = batchRes.body.data.id;
  });

  test('应该能正常发放批次', async () => {
    const res = await request(app)
      .post('/api/distribution/distribute')
      .send({
        batchId: batchId,
        recipientId: 'RECIPIENT001',
        containersUsed: 1,
        verifiedBy: 'NURSE001'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.verification_status).toBe('verified');
  });

  test('不能发放超过库存的数量', async () => {
    const res = await request(app)
      .post('/api/distribution/distribute')
      .send({
        batchId: batchId,
        recipientId: 'RECIPIENT002',
        containersUsed: 10
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('超出');
  });

  test('应该能核验发放记录', async () => {
    const distRes = await request(app)
      .post('/api/distribution/distribute')
      .send({
        batchId: batchId,
        recipientId: 'RECIPIENT003',
        containersUsed: 1
      });
    const distId = distRes.body.data.id;

    const verifyRes = await request(app)
      .post(`/api/distribution/distributions/${distId}/verify`)
      .send({
        verifiedBy: 'NURSE002'
      });

    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.body.data.verification_status).toBe('verified');
  });
});

describe('召回追溯测试', () => {
  let batchId;

  beforeAll(async () => {
    const donationRes = await request(app)
      .post('/api/donations')
      .send({
        donorId: 'DONOR_RECALL',
        donationDate: '2026-05-10',
        quantityMl: 200
      });
    const donationId = donationRes.body.data.id;

    const criticalTests = ['hiv', 'htlv', 'hbsag', 'syphilis', 'bacterial_culture'];
    for (const testType of criticalTests) {
      await request(app)
        .post('/api/tests')
        .send({
          donationId: donationId,
          testType: testType,
          result: 'negative',
          testDate: '2026-05-10'
        });
    }

    const batchRes = await request(app)
      .post('/api/batches')
      .send({
        donationId: donationId,
        containerType: 'bag_100ml',
        containerCount: 2,
        freezerLocation: 'FREEZER-A'
      });
    batchId = batchRes.body.data.id;

    await request(app)
      .post('/api/distribution/distribute')
      .send({
        batchId: batchId,
        recipientId: 'RECIPIENT_RISK',
        containersUsed: 1,
        verifiedBy: 'NURSE001'
      });
  });

  test('应该能发起召回', async () => {
    const res = await request(app)
      .post('/api/distribution/recalls')
      .send({
        batchId: batchId,
        reason: '检测结果重新评估发现异常'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('in_progress');
  });

  test('批次追溯应该能显示完整路径', async () => {
    const res = await request(app)
      .get(`/api/batches/${batchId}/traceability`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.trace_path).toBeDefined();
    expect(res.body.data.trace_path.length).toBeGreaterThan(0);
    expect(res.body.data.affected_recipients).toContain('RECIPIENT_RISK');
  });

  test('召回后批次状态应该更新', async () => {
    const batchRes = await request(app).get(`/api/batches/${batchId}`);
    expect(batchRes.body.data.status).toBe('recalled');
  });
});

describe('幂等性测试', () => {
  test('带相同requestId的重复请求应该返回相同结果', async () => {
    const requestId = 'test-idempotent-' + Date.now();

    const res1 = await request(app)
      .post('/api/donations')
      .set('x-request-id', requestId)
      .send({
        donorId: 'DONOR_IDEMPOTENT',
        donationDate: '2026-05-10',
        quantityMl: 100
      });

    const res2 = await request(app)
      .post('/api/donations')
      .set('x-request-id', requestId)
      .send({
        donorId: 'DONOR_IDEMPOTENT',
        donationDate: '2026-05-10',
        quantityMl: 100
      });

    expect(res1.body.data.id).toBe(res2.body.data.id);
    expect(res1.body.data.created_at).toBe(res2.body.data.created_at);

    const donations = await request(app)
      .get('/api/donations')
      .query({ donorId: 'DONOR_IDEMPOTENT' });

    expect(donations.body.count).toBe(1);
  });
});

describe('库存报表测试', () => {
  beforeAll(async () => {
    const donationRes = await request(app)
      .post('/api/donations')
      .send({
        donorId: 'DONOR_REPORT',
        donationDate: '2026-05-10',
        quantityMl: 300
      });
    const donationId = donationRes.body.data.id;

    const criticalTests = ['hiv', 'htlv', 'hbsag', 'syphilis', 'bacterial_culture'];
    for (const testType of criticalTests) {
      await request(app)
        .post('/api/tests')
        .send({
          donationId: donationId,
          testType: testType,
          result: 'negative',
          testDate: '2026-05-10'
        });
    }

    await request(app)
      .post('/api/batches')
      .send({
        donationId: donationId,
        containerType: 'bag_100ml',
        containerCount: 3,
        freezerLocation: 'FREEZER-REPORT'
      });
  });

  test('库存报表应该返回正确统计', async () => {
    const res = await request(app).get('/api/reports/inventory');

    expect(res.statusCode).toBe(200);
    expect(res.body.data.summary).toBeDefined();
    expect(res.body.data.batch_inventory).toBeDefined();
    expect(res.body.data.freezers).toBeDefined();
  });

  test('批次详细报告应该包含风险评估', async () => {
    const batches = await request(app)
      .get('/api/batches')
      .query({ freezerLocation: 'FREEZER-REPORT' });

    const batchId = batches.body.data[0].id;
    const res = await request(app).get(`/api/reports/batch/${batchId}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.risk_assessment).toBeDefined();
    expect(res.body.data.risk_assessment.overall_risk).toBeDefined();
  });
});
