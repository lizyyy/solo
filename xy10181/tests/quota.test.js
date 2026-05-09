const { v4: uuidv4 } = require('uuid');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/database');
const { initTables, initTriggers, initSampleData } = require('../src/models/dbInit');

beforeAll(async () => {
  await initTables();
  await initTriggers();
  await initSampleData();
});

afterAll(async () => {
  await db.pool.end();
});

describe('健康检查', () => {
  test('GET /health 应返回服务状态', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.code).toBe(0);
    expect(response.body.message).toBe('服务正常');
  });
});

describe('审批流程测试', () => {
  let requestId;

  test('1. 提交审批申请 - 应该成功占用限额', async () => {
    requestId = uuidv4();
    const response = await request(app)
      .post('/api/v1/quota/apply')
      .send({
        quotaCode: 'QUOTA_001',
        applyAmount: 10000.00,
        applicant: '张三',
        reason: '采购办公用品',
        requestId: requestId,
      });

    expect(response.status).toBe(201);
    expect(response.body.code).toBe(0);
    expect(response.body.data.requestId).toBe(requestId);
    expect(response.body.data.status).toBe('pending');
    expect(response.body.data.quotaSnapshot.occupied).toBeGreaterThan(0);
  });

  test('2. 重复提交相同 requestId - 应该返回已有记录，不制造脏数据', async () => {
    const response = await request(app)
      .post('/api/v1/quota/apply')
      .send({
        quotaCode: 'QUOTA_001',
        applyAmount: 10000.00,
        applicant: '张三',
        reason: '采购办公用品',
        requestId: requestId,
      });

    expect(response.status).toBe(201);
    expect(response.body.code).toBe(0);
    expect(response.body.data.requestId).toBe(requestId);
  });

  test('3. 查询审批状态 - 应该返回 pending', async () => {
    const response = await request(app)
      .get(`/api/v1/quota/${requestId}/status`);

    expect(response.status).toBe(200);
    expect(response.body.code).toBe(0);
    expect(response.body.data.status).toBe('pending');
  });

  test('4. 审批通过 - 应该扣除限额', async () => {
    const response = await request(app)
      .post(`/api/v1/quota/${requestId}/approve`)
      .send({
        approver: '王经理',
        comments: '同意采购',
      });

    expect(response.status).toBe(200);
    expect(response.body.code).toBe(0);
    expect(response.body.data.status).toBe('approved');
    expect(response.body.data.quotaSnapshot.used).toBeGreaterThan(0);
  });
});

describe('驳回和撤回测试', () => {
  test('1. 提交申请后驳回 - 应该释放占用的限额', async () => {
    const reqId = uuidv4();
    await request(app)
      .post('/api/v1/quota/apply')
      .send({
        quotaCode: 'QUOTA_002',
        applyAmount: 5000.00,
        applicant: '李四',
        reason: '项目A费用申请',
        requestId: reqId,
      });

    const response = await request(app)
      .post(`/api/v1/quota/${reqId}/reject`)
      .send({
        approver: '李总',
        comments: '预算不足，驳回',
      });

    expect(response.status).toBe(200);
    expect(response.body.code).toBe(0);
    expect(response.body.data.status).toBe('rejected');
  });

  test('2. 提交申请后撤回 - 应该释放占用的限额', async () => {
    const reqId = uuidv4();
    await request(app)
      .post('/api/v1/quota/apply')
      .send({
        quotaCode: 'QUOTA_003',
        applyAmount: 3000.00,
        applicant: '王五',
        reason: '出差费用',
        requestId: reqId,
      });

    const response = await request(app)
      .post(`/api/v1/quota/${reqId}/cancel`)
      .send({
        operator: '王五',
        comments: '取消出差计划',
      });

    expect(response.status).toBe(200);
    expect(response.body.code).toBe(0);
    expect(response.body.data.status).toBe('canceled');
  });
});

describe('限额不足测试', () => {
  test('申请金额超过可用限额 - 应该返回错误', async () => {
    const response = await request(app)
      .post('/api/v1/quota/apply')
      .send({
        quotaCode: 'QUOTA_003',
        applyAmount: 10000000.00,
        applicant: '测试用户',
        reason: '测试超额',
        requestId: uuidv4(),
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(1002);
    expect(response.body.message).toContain('限额不足');
  });
});

describe('统计接口测试', () => {
  test('获取汇总统计 - 应该返回统计数据', async () => {
    const response = await request(app)
      .get('/api/v1/quota/stats/summary');

    expect(response.status).toBe(200);
    expect(response.body.code).toBe(0);
    expect(response.body.data).toHaveProperty('quotaSummary');
    expect(response.body.data).toHaveProperty('approvalSummary');
    expect(response.body.data).toHaveProperty('operationSummary');
  });

  test('一致性校验 - 应该通过', async () => {
    const response = await request(app)
      .get('/api/v1/quota/stats/consistency');

    expect(response.status).toBe(200);
    expect(response.body.code).toBe(0);
    expect(response.body.data.consistent).toBe(true);
  });

  test('获取审计日志 - 应该返回记录', async () => {
    const response = await request(app)
      .get('/api/v1/quota/stats/audit?limit=10');

    expect(response.status).toBe(200);
    expect(response.body.code).toBe(0);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});

describe('参数验证测试', () => {
  test('缺少必填字段 - 应该返回验证错误', async () => {
    const response = await request(app)
      .post('/api/v1/quota/apply')
      .send({
        applyAmount: 1000.00,
        applicant: '测试',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(4000);
  });

  test('无效金额 - 应该返回验证错误', async () => {
    const response = await request(app)
      .post('/api/v1/quota/apply')
      .send({
        quotaCode: 'QUOTA_001',
        applyAmount: -100.00,
        applicant: '测试',
        requestId: uuidv4(),
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(4000);
  });

  test('不存在的 requestId - 应该返回错误', async () => {
    const response = await request(app)
      .get(`/api/v1/quota/nonexistent-id/status`);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(2001);
  });
});
