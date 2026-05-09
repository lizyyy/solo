const request = require('supertest');
const app = require('../src/server');
const { sequelize } = require('../src/models');

process.env.NODE_ENV = 'test';

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('赔付案件分摊 API 测试', () => {
  let claimId = null;
  
  describe('POST /api/claims - 创建案件', () => {
    test('应该成功创建案件', async () => {
      const res = await request(app)
        .post('/api/claims')
        .send({
          caseNumber: 'TEST-2026-001',
          totalAmount: 10000.00,
          description: '测试案件',
          operator: 'test_user'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.code).toBe('CREATED');
      expect(res.body.data.caseNumber).toBe('TEST-2026-001');
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.currentVersion).toBe(1);
      claimId = res.body.data.id;
    });
    
    test('案件编号重复应该返回 409', async () => {
      const res = await request(app)
        .post('/api/claims')
        .send({
          caseNumber: 'TEST-2026-001',
          totalAmount: 5000.00,
          operator: 'test_user'
        });
      
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('CASE_NUMBER_EXISTS');
    });
    
    test('缺少必填字段应该返回 400', async () => {
      const res = await request(app)
        .post('/api/claims')
        .send({
          totalAmount: 10000.00
        });
      
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_FIELDS');
    });
  });
  
  describe('POST /api/claims/:id/ratios - 更新责任比例', () => {
    test('应该成功更新责任比例', async () => {
      const res = await request(app)
        .post(`/api/claims/${claimId}/ratios`)
        .send({
          merchantRatio: 0.5,
          warehouseRatio: 0.3,
          deliveryRatio: 0.2,
          operator: 'test_user'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.code).toBe('UPDATED');
      expect(res.body.data.currentVersion).toBe(2);
      expect(res.body.data.status).toBe('REVIEWING');
      
      const allocation = res.body.data.currentAllocation;
      expect(allocation.merchantRatio).toBe(0.5);
      expect(allocation.warehouseRatio).toBe(0.3);
      expect(allocation.deliveryRatio).toBe(0.2);
      expect(allocation.merchantAmount).toBe(5000.00);
      expect(allocation.warehouseAmount).toBe(3000.00);
      expect(allocation.deliveryAmount).toBe(2000.00);
    });
    
    test('比例之和不为 100% 应该返回错误', async () => {
      const res = await request(app)
        .post(`/api/claims/${claimId}/ratios`)
        .send({
          merchantRatio: 0.5,
          warehouseRatio: 0.5,
          deliveryRatio: 0.2,
          operator: 'test_user'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INVALID_RATIO');
    });
    
    test('使用相同 requestId 应该被拦截为重复提交', async () => {
      const requestId = 'req-001';
      
      const res1 = await request(app)
        .post(`/api/claims/${claimId}/ratios`)
        .send({
          merchantRatio: 0.6,
          warehouseRatio: 0.2,
          deliveryRatio: 0.2,
          operator: 'test_user',
          requestId
        });
      expect(res1.status).toBe(200);
      
      const res2 = await request(app)
        .post(`/api/claims/${claimId}/ratios`)
        .send({
          merchantRatio: 0.6,
          warehouseRatio: 0.2,
          deliveryRatio: 0.2,
          operator: 'test_user',
          requestId
        });
      expect(res2.status).toBe(409);
      expect(res2.body.code).toBe('DUPLICATE_REQUEST');
    });
    
    test('更新不存在的案件应该返回 404', async () => {
      const res = await request(app)
        .post('/api/claims/00000000-0000-0000-0000-000000000000/ratios')
        .send({
          merchantRatio: 0.3,
          warehouseRatio: 0.4,
          deliveryRatio: 0.3,
          operator: 'test_user'
        });
      
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('CLAIM_NOT_FOUND');
    });
  });
  
  describe('案件状态流转', () => {
    let flowClaimId = null;
    
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/claims')
        .send({
          caseNumber: `FLOW-${Date.now()}`,
          totalAmount: 8000.00,
          operator: 'test_user'
        });
      flowClaimId = res.body.data.id;
      
      await request(app)
        .post(`/api/claims/${flowClaimId}/ratios`)
        .send({
          merchantRatio: 0.4,
          warehouseRatio: 0.35,
          deliveryRatio: 0.25,
          operator: 'test_user'
        });
    });
    
    test('应该完成完整的状态流转', async () => {
      const res1 = await request(app)
        .post(`/api/claims/${flowClaimId}/allocate`)
        .send({ operator: 'test_user' });
      expect(res1.status).toBe(200);
      expect(res1.body.data.status).toBe('ALLOCATED');
      
      const res2 = await request(app)
        .post(`/api/claims/${flowClaimId}/confirm`)
        .send({ operator: 'test_user' });
      expect(res2.status).toBe(200);
      expect(res2.body.data.status).toBe('CONFIRMED');
      
      const res3 = await request(app)
        .post(`/api/claims/${flowClaimId}/pay`)
        .send({ operator: 'test_user' });
      expect(res3.status).toBe(200);
      expect(res3.body.data.status).toBe('PAID');
    });
    
    test('未设置比例的案件不能分摊', async () => {
      const res = await request(app)
        .post('/api/claims')
        .send({
          caseNumber: `NO-RATIO-${Date.now()}`,
          totalAmount: 5000.00,
          operator: 'test_user'
        });
      const noRatioClaimId = res.body.data.id;
      
      const allocateRes = await request(app)
        .post(`/api/claims/${noRatioClaimId}/allocate`)
        .send({ operator: 'test_user' });
      
      expect(allocateRes.status).toBe(400);
      expect(allocateRes.body.code).toBe('NO_RATIOS_SET');
    });
    
    test('非法状态转换应该被拒绝', async () => {
      const res = await request(app)
        .post('/api/claims')
        .send({
          caseNumber: `INVALID-FLOW-${Date.now()}`,
          totalAmount: 5000.00,
          operator: 'test_user'
        });
      const invalidClaimId = res.body.data.id;
      
      const confirmRes = await request(app)
        .post(`/api/claims/${invalidClaimId}/confirm`)
        .send({ operator: 'test_user' });
      
      expect(confirmRes.status).toBe(400);
      expect(confirmRes.body.code).toBe('INVALID_STATUS_TRANSITION');
    });
    
    test('已付款的案件不能修改比例', async () => {
      const res = await request(app)
        .post('/api/claims')
        .send({
          caseNumber: `PAID-${Date.now()}`,
          totalAmount: 5000.00,
          operator: 'test_user'
        });
      const paidClaimId = res.body.data.id;
      
      await request(app)
        .post(`/api/claims/${paidClaimId}/ratios`)
        .send({
          merchantRatio: 0.5,
          warehouseRatio: 0.3,
          deliveryRatio: 0.2,
          operator: 'test_user'
        });
      
      await request(app)
        .post(`/api/claims/${paidClaimId}/allocate`)
        .send({ operator: 'test_user' });
      
      await request(app)
        .post(`/api/claims/${paidClaimId}/confirm`)
        .send({ operator: 'test_user' });
      
      await request(app)
        .post(`/api/claims/${paidClaimId}/pay`)
        .send({ operator: 'test_user' });
      
      const ratioRes = await request(app)
        .post(`/api/claims/${paidClaimId}/ratios`)
        .send({
          merchantRatio: 0.6,
          warehouseRatio: 0.2,
          deliveryRatio: 0.2,
          operator: 'test_user'
        });
      
      expect(ratioRes.status).toBe(400);
      expect(ratioRes.body.code).toBe('INVALID_STATUS');
    });
  });
  
  describe('GET /api/claims/:id/versions - 版本历史', () => {
    test('应该能查询版本历史', async () => {
      const res = await request(app)
        .get(`/api/claims/${claimId}/versions`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      
      const latest = res.body.data[0];
      expect(latest.version).toBeDefined();
      expect(latest.merchantRatio).toBeDefined();
    });
  });
  
  describe('POST /api/claims/:id/rollback - 回滚功能', () => {
    let rollbackClaimId = null;
    
    beforeAll(async () => {
      const res = await request(app)
        .post('/api/claims')
        .send({
          caseNumber: `ROLLBACK-${Date.now()}`,
          totalAmount: 12000.00,
          operator: 'test_user'
        });
      rollbackClaimId = res.body.data.id;
      
      await request(app)
        .post(`/api/claims/${rollbackClaimId}/ratios`)
        .send({
          merchantRatio: 0.3,
          warehouseRatio: 0.3,
          deliveryRatio: 0.4,
          operator: 'user_a'
        });
      
      await request(app)
        .post(`/api/claims/${rollbackClaimId}/ratios`)
        .send({
          merchantRatio: 0.5,
          warehouseRatio: 0.3,
          deliveryRatio: 0.2,
          operator: 'user_b'
        });
    });
    
    test('应该能回滚到历史版本', async () => {
      const res = await request(app)
        .post(`/api/claims/${rollbackClaimId}/rollback`)
        .send({
          targetVersion: 2,
          operator: 'test_user'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.code).toBe('ROLLED_BACK');
      expect(res.body.data.currentVersion).toBe(4);
      
      const allocation = res.body.data.currentAllocation;
      expect(allocation.merchantRatio).toBe(0.3);
      expect(allocation.warehouseRatio).toBe(0.3);
      expect(allocation.deliveryRatio).toBe(0.4);
    });
    
    test('回滚到不存在的版本应该返回 404', async () => {
      const res = await request(app)
        .post(`/api/claims/${rollbackClaimId}/rollback`)
        .send({
          targetVersion: 999,
          operator: 'test_user'
        });
      
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('VERSION_NOT_FOUND');
    });
  });
  
  describe('GET /api/claims/:id/audit-logs - 审计日志', () => {
    test('应该能查询审计日志', async () => {
      const res = await request(app)
        .get(`/api/claims/${claimId}/audit-logs`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      
      const log = res.body.data[0];
      expect(log.action).toBeDefined();
      expect(log.operator).toBeDefined();
      expect(log.success).toBeDefined();
    });
  });
  
  describe('GET /api/claims - 列表查询', () => {
    test('应该能分页查询案件列表', async () => {
      const res = await request(app)
        .get('/api/claims')
        .query({ page: 1, pageSize: 5 });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.pageSize).toBe(5);
    });
    
    test('应该能按状态过滤', async () => {
      const res = await request(app)
        .get('/api/claims')
        .query({ status: 'REVIEWING' });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      res.body.data.claims.forEach(c => {
        expect(c.status).toBe('REVIEWING');
      });
    });
  });
});
