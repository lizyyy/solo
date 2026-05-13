const { v4: uuidv4 } = require('uuid');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/database');
const { initTables, initTriggers, initSampleData } = require('../src/models/dbInit');
const QuotaModel = require('../src/models/QuotaModel');

beforeAll(async () => {
  await initTables();
  await initTriggers();
  await initSampleData();
  
  await db.query(`
    INSERT INTO quotas (quota_code, quota_name, total_amount, available_amount, is_active, effective_start_date)
    VALUES ('CONCURRENT_TEST', '并发测试限额', 100000.00, 100000.00, TRUE, CURRENT_TIMESTAMP)
    ON CONFLICT (quota_code) DO UPDATE SET
      total_amount = 100000.00,
      used_amount = 0,
      occupied_amount = 0,
      available_amount = 100000.00,
      version = 1
  `);
});

afterAll(async () => {
  await db.query(`DELETE FROM quotas WHERE quota_code = 'CONCURRENT_TEST'`);
  await db.pool.end();
});

describe('并发控制测试', () => {
  test('两笔并发大额申请 - 只有一笔应该成功，限额不应扣成负数', async () => {
    await db.query(`
      UPDATE quotas SET 
        total_amount = 100000.00,
        used_amount = 0,
        occupied_amount = 0,
        available_amount = 100000.00,
        version = 1
      WHERE quota_code = 'CONCURRENT_TEST'
    `);

    const request1 = {
      quotaCode: 'CONCURRENT_TEST',
      applyAmount: 80000.00,
      applicant: '用户A',
      reason: '大额申请A',
      requestId: `CONC-A-${Date.now()}`,
    };

    const request2 = {
      quotaCode: 'CONCURRENT_TEST',
      applyAmount: 80000.00,
      applicant: '用户B',
      reason: '大额申请B',
      requestId: `CONC-B-${Date.now()}`,
    };

    const results = await Promise.allSettled([
      request(app).post('/api/v1/quota/apply').send(request1),
      request(app).post('/api/v1/quota/apply').send(request2),
    ]);

    const responses = results.map(r => 
      r.status === 'fulfilled' ? r.value : { body: { code: -1, message: '请求失败' } }
    );

    const successResponses = responses.filter(r => r.body && r.body.code === 0);
    const failResponses = responses.filter(r => r.body && r.body.code !== 0);

    console.log('并发测试结果:');
    console.log('  成功数:', successResponses.length);
    console.log('  失败数:', failResponses.length);
    responses.forEach((r, i) => {
      console.log(`  响应${i+1}:`, r.body);
    });

    expect(successResponses.length).toBe(1);
    expect(failResponses.length).toBe(1);

    const finalQuota = await QuotaModel.findByCode('CONCURRENT_TEST');
    expect(parseFloat(finalQuota.available_amount)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(finalQuota.occupied_amount)).toBe(80000);
    expect(parseFloat(finalQuota.available_amount)).toBe(20000);

    const consistencyCheck = await request(app).get('/api/v1/quota/stats/consistency');
    expect(consistencyCheck.body.data.consistent).toBe(true);
  });

  test('多笔并发小额申请 - 应根据可用额度部分成功', async () => {
    await db.query(`
      UPDATE quotas SET 
        total_amount = 100000.00,
        used_amount = 0,
        occupied_amount = 0,
        available_amount = 100000.00,
        version = 1
      WHERE quota_code = 'CONCURRENT_TEST'
    `);

    const requests = [];
    for (let i = 0; i < 5; i++) {
      requests.push({
        quotaCode: 'CONCURRENT_TEST',
        applyAmount: 25000.00,
        applicant: `用户${i}`,
        reason: `申请${i}`,
        requestId: `MULTI-${i}-${Date.now()}`,
      });
    }

    const results = await Promise.allSettled(
      requests.map(req => request(app).post('/api/v1/quota/apply').send(req))
    );

    const responses = results.map(r => 
      r.status === 'fulfilled' ? r.value : { body: { code: -1, message: '请求失败' } }
    );

    const successResponses = responses.filter(r => r.body && r.body.code === 0);
    const failResponses = responses.filter(r => r.body && r.body.code !== 0);

    console.log('多笔并发测试结果:');
    console.log('  成功数:', successResponses.length);
    console.log('  失败数:', failResponses.length);

    expect(successResponses.length).toBe(4);
    expect(failResponses.length).toBe(1);

    const finalQuota = await QuotaModel.findByCode('CONCURRENT_TEST');
    expect(parseFloat(finalQuota.occupied_amount)).toBe(100000);
    expect(parseFloat(finalQuota.available_amount)).toBe(0);
  });

  test('重复提交相同 requestId（幂等性）- 不应重复占用', async () => {
    await db.query(`
      UPDATE quotas SET 
        total_amount = 100000.00,
        used_amount = 0,
        occupied_amount = 0,
        available_amount = 100000.00,
        version = 1
      WHERE quota_code = 'CONCURRENT_TEST'
    `);

    const requestId = `IDEMPOTENT-${Date.now()}`;
    const applyData = {
      quotaCode: 'CONCURRENT_TEST',
      applyAmount: 10000.00,
      applicant: '幂等测试用户',
      reason: '幂等性测试',
      requestId: requestId,
    };

    const results = await Promise.allSettled([
      request(app).post('/api/v1/quota/apply').send(applyData),
      request(app).post('/api/v1/quota/apply').send(applyData),
      request(app).post('/api/v1/quota/apply').send(applyData),
    ]);

    const responses = results.map(r => 
      r.status === 'fulfilled' ? r.value : { body: { code: -1, message: '请求失败' } }
    );

    responses.forEach((r, i) => {
      expect(r.body.code).toBe(0);
      expect(r.body.data.requestId).toBe(requestId);
    });

    const finalQuota = await QuotaModel.findByCode('CONCURRENT_TEST');
    expect(parseFloat(finalQuota.occupied_amount)).toBe(10000);
    expect(parseFloat(finalQuota.available_amount)).toBe(90000);

    const consistencyCheck = await request(app).get('/api/v1/quota/stats/consistency');
    expect(consistencyCheck.body.data.consistent).toBe(true);
  });
});
