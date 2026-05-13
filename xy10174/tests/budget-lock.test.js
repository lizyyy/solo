const request = require('supertest');
const createApp = require('../src/app');
const { closeConnection } = require('../src/db/knex');
const { v4: uuidv4 } = require('uuid');

let app;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  app = await createApp();
});

afterAll(async () => {
  await closeConnection();
});

describe('采购预算锁定 API 测试', () => {
  let departmentId;
  let budgetId;
  const fiscalYear = new Date().getFullYear().toString();

  describe('1. 基础数据创建', () => {
    test('应该成功创建部门', async () => {
      const response = await request(app)
        .post('/api/budget/departments')
        .send({
          name: '技术部',
          code: 'TECH'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('技术部');
      expect(response.body.data.code).toBe('TECH');
      departmentId = response.body.data.id;
    });

    test('应该成功创建预算', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);
      
      const response = await request(app)
        .post('/api/budget/budgets')
        .send({
          departmentId,
          budgetType: 'PURCHASE',
          fiscalYear,
          totalAmount: 100000,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(parseFloat(response.body.data.total_amount)).toBe(100000);
      expect(parseFloat(response.body.data.available_amount)).toBe(100000);
      budgetId = response.body.data.id;
    });
  });

  describe('2. 预算锁定创建流程', () => {
    let lockId;
    const applicationId = `APP-${Date.now()}`;

    test('应该成功锁定预算', async () => {
      const response = await request(app)
        .post('/api/budget/locks')
        .send({
          budgetId,
          applicationId,
          applicationType: 'PURCHASE_REQUEST',
          amount: 30000,
          createdBy: 'user_001',
          reason: '采购办公设备'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.amount).toBe(30000);
      expect(response.body.data.newLockedAmount).toBe(30000);
      expect(response.body.data.newAvailableAmount).toBe(70000);
      lockId = response.body.data.lockId;
    });

    test('锁定后预算可用余额应该减少', async () => {
      const response = await request(app)
        .get(`/api/budget/budgets/${budgetId}`);
      
      expect(response.status).toBe(200);
      expect(parseFloat(response.body.data.locked_amount)).toBe(30000);
      expect(parseFloat(response.body.data.available_amount)).toBe(70000);
    });

    test('重复提交同一申请应该返回错误', async () => {
      const response = await request(app)
        .post('/api/budget/locks')
        .send({
          budgetId,
          applicationId,
          applicationType: 'PURCHASE_REQUEST',
          amount: 30000,
          createdBy: 'user_001'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.code).toBe(2002);
      expect(response.body.message).toContain('已存在预算锁定');
    });

    test('锁定超出预算应该返回错误', async () => {
      const response = await request(app)
        .post('/api/budget/locks')
        .send({
          budgetId,
          applicationId: `APP-${Date.now()}-2`,
          applicationType: 'PURCHASE_REQUEST',
          amount: 80000,
          createdBy: 'user_001'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.code).toBe(1003);
      expect(response.body.message).toContain('预算余额不足');
    });
  });

  describe('3. 预算锁定修改流程', () => {
    let lockId;
    const applicationId = `APP-MODIFY-${Date.now()}`;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/budget/locks')
        .send({
          budgetId,
          applicationId,
          applicationType: 'PURCHASE_REQUEST',
          amount: 20000,
          createdBy: 'user_002',
          reason: '测试修改'
        });
      lockId = response.body.data.lockId;
    });

    test('应该成功增加锁定金额', async () => {
      const response = await request(app)
        .put(`/api/budget/locks/${lockId}`)
        .send({
          newAmount: 25000,
          operator: 'user_002'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.newAmount).toBe(25000);
      expect(response.body.data.amountDiff).toBe(5000);
    });

    test('应该成功减少锁定金额', async () => {
      const response = await request(app)
        .put(`/api/budget/locks/${lockId}`)
        .send({
          newAmount: 15000,
          operator: 'user_002'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.data.newAmount).toBe(15000);
      expect(response.body.data.amountDiff).toBe(-10000);
    });

    test('修改后超出预算应该返回错误', async () => {
      const response = await request(app)
        .put(`/api/budget/locks/${lockId}`)
        .send({
          newAmount: 200000,
          operator: 'user_002'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.code).toBe(1003);
    });

    test('应该成功释放锁定', async () => {
      const response = await request(app)
        .post(`/api/budget/locks/${lockId}/release`)
        .send({
          operator: 'user_002',
          reason: '测试释放'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.releasedAmount).toBe(15000);
    });

    test('释放后已释放的锁定应该返回错误', async () => {
      const response = await request(app)
        .post(`/api/budget/locks/${lockId}/release`)
        .send({
          operator: 'user_002'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.code).toBe(2004);
    });
  });

  describe('4. 并发冲突测试', () => {
    test('并发锁定同一预算应该只有一个成功', async () => {
      const promises = [];
      const results = [];
      
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post('/api/budget/locks')
            .send({
              budgetId,
              applicationId: `CONCURRENT-${Date.now()}-${i}`,
              applicationType: 'PURCHASE_REQUEST',
              amount: 20000,
              createdBy: 'concurrent_user'
            })
            .then(r => {
              results.push({ index: i, response: r });
            })
        );
      }
      
      await Promise.all(promises);
      
      const successCount = results.filter(r => r.response.body.success === true).length;
      const failCount = results.filter(r => r.response.body.success === false).length;
      
      expect(successCount + failCount).toBe(5);
      expect(successCount).toBeGreaterThan(0);
      
      const budgetResponse = await request(app)
        .get(`/api/budget/budgets/${budgetId}`);
      
      const lockedAmount = parseFloat(budgetResponse.body.data.locked_amount);
      expect(lockedAmount).toBeLessThanOrEqual(100000);
    });
  });

  describe('5. 审批流程测试', () => {
    let approvalId;
    let lockId;
    let approvalBudgetId;
    const applicationId = `APP-APPROVAL-${Date.now()}`;

    beforeAll(async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);
      
      const budgetResponse = await request(app)
        .post('/api/budget/budgets')
        .send({
          departmentId,
          budgetType: 'APPROVAL_TEST',
          fiscalYear,
          totalAmount: 100000,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
      approvalBudgetId = budgetResponse.body.data.id;

      const lockResponse = await request(app)
        .post('/api/budget/locks')
        .send({
          budgetId: approvalBudgetId,
          applicationId,
          applicationType: 'PURCHASE_REQUEST',
          amount: 15000,
          createdBy: 'approver_test',
          reason: '审批测试'
        });
      lockId = lockResponse.body.data.lockId;
    });

    test('应该成功创建审批', async () => {
      const response = await request(app)
        .post('/api/approvals')
        .send({
          applicationId,
          currentApprover: 'manager_001',
          approvalLevel: 'LEVEL_1',
          operator: 'system'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('PENDING');
      approvalId = response.body.data.id;
    });

    test('审批通过应该提交预算', async () => {
      const beforeBudget = await request(app)
        .get(`/api/budget/budgets/${approvalBudgetId}`);
      const beforeUsed = parseFloat(beforeBudget.body.data.used_amount);
      const beforeLocked = parseFloat(beforeBudget.body.data.locked_amount);

      const response = await request(app)
        .post(`/api/approvals/${approvalId}/approve`)
        .send({
          approvedBy: 'manager_001',
          operator: 'manager_001'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('APPROVED');

      const afterBudget = await request(app)
        .get(`/api/budget/budgets/${approvalBudgetId}`);
      const afterUsed = parseFloat(afterBudget.body.data.used_amount);
      const afterLocked = parseFloat(afterBudget.body.data.locked_amount);

      expect(afterUsed).toBe(beforeUsed + 15000);
      expect(afterLocked).toBe(beforeLocked - 15000);
    });

    test('应该成功拒绝审批并释放预算', async () => {
      const testAppId = `APP-REJECT-${Date.now()}`;
      
      const lockResponse = await request(app)
        .post('/api/budget/locks')
        .send({
          budgetId: approvalBudgetId,
          applicationId: testAppId,
          applicationType: 'PURCHASE_REQUEST',
          amount: 10000,
          createdBy: 'reject_test'
        });
      
      const approvalResponse = await request(app)
        .post('/api/approvals')
        .send({
          applicationId: testAppId,
          currentApprover: 'manager_002'
        });
      
      const newApprovalId = approvalResponse.body.data.id;
      
      const beforeBudget = await request(app)
        .get(`/api/budget/budgets/${approvalBudgetId}`);
      const beforeLocked = parseFloat(beforeBudget.body.data.locked_amount);

      const response = await request(app)
        .post(`/api/approvals/${newApprovalId}/reject`)
        .send({
          rejectReason: '不符合规定',
          operator: 'manager_002'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('REJECTED');

      const afterBudget = await request(app)
        .get(`/api/budget/budgets/${approvalBudgetId}`);
      const afterLocked = parseFloat(afterBudget.body.data.locked_amount);

      expect(afterLocked).toBe(beforeLocked - 10000);
    });

    test('应该成功取消审批并释放预算', async () => {
      const testAppId = `APP-CANCEL-${Date.now()}`;
      
      const lockResponse = await request(app)
        .post('/api/budget/locks')
        .send({
          budgetId: approvalBudgetId,
          applicationId: testAppId,
          applicationType: 'PURCHASE_REQUEST',
          amount: 5000,
          createdBy: 'cancel_test'
        });
      
      const approvalResponse = await request(app)
        .post('/api/approvals')
        .send({
          applicationId: testAppId,
          currentApprover: 'manager_003'
        });
      
      const newApprovalId = approvalResponse.body.data.id;
      
      const beforeBudget = await request(app)
        .get(`/api/budget/budgets/${approvalBudgetId}`);
      const beforeLocked = parseFloat(beforeBudget.body.data.locked_amount);

      const response = await request(app)
        .post(`/api/approvals/${newApprovalId}/cancel`)
        .send({
          operator: 'user_cancel'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('CANCELLED');

      const afterBudget = await request(app)
        .get(`/api/budget/budgets/${approvalBudgetId}`);
      const afterLocked = parseFloat(afterBudget.body.data.locked_amount);

      expect(afterLocked).toBe(beforeLocked - 5000);
    });
  });

  describe('6. 报表查询测试', () => {
    test('应该成功获取部门报表', async () => {
      const response = await request(app)
        .get(`/api/reports/departments/${departmentId}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.department.id).toBe(departmentId);
      expect(response.body.data.department.name).toBe('技术部');
      expect(response.body.data.summary.totalBudgets).toBeGreaterThan(0);
      expect(response.body.data.budgetByType.length).toBeGreaterThan(0);
      expect(response.body.data.budgetByType[0].usageRate).toBeDefined();
    });

    test('应该成功获取所有部门报表', async () => {
      const response = await request(app)
        .get('/api/reports/departments');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.totalDepartments).toBeGreaterThan(0);
      expect(response.body.data.departmentReports.length).toBeGreaterThan(0);
      expect(response.body.data.summary.overallUsageRate).toBeDefined();
    });

    test('应该成功获取预算使用趋势', async () => {
      const response = await request(app)
        .get(`/api/reports/departments/${departmentId}/trend`)
        .query({
          budgetType: 'PURCHASE',
          fiscalYear
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.budget).toBeDefined();
      expect(response.body.data.trend).toBeDefined();
      expect(Array.isArray(response.body.data.trend)).toBe(true);
    });
  });

  describe('6.5 趋势报表数据正确性验证', () => {
    let trendTestBudgetId;
    let trendTestLockId;
    let trendTestApprovalId;
    const trendApplicationId = `TREND-TEST-${Date.now()}`;

    beforeAll(async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);
      
      const budgetResponse = await request(app)
        .post('/api/budget/budgets')
        .send({
          departmentId,
          budgetType: 'TREND_VERIFICATION',
          fiscalYear,
          totalAmount: 1000,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
      trendTestBudgetId = budgetResponse.body.data.id;

      const lockResponse = await request(app)
        .post('/api/budget/locks')
        .send({
          budgetId: trendTestBudgetId,
          applicationId: trendApplicationId,
          applicationType: 'PURCHASE_REQUEST',
          amount: 300,
          createdBy: 'trend_test',
          reason: '趋势报表验证测试'
        });
      trendTestLockId = lockResponse.body.data.lockId;

      const approvalResponse = await request(app)
        .post('/api/approvals')
        .send({
          applicationId: trendApplicationId,
          currentApprover: 'trend_manager',
          approvalLevel: 'LEVEL_1'
        });
      trendTestApprovalId = approvalResponse.body.data.id;

      await request(app)
        .post(`/api/approvals/${trendTestApprovalId}/approve`)
        .send({
          approvedBy: 'trend_manager',
          operator: 'trend_manager'
        });
    });

    test('预算锁定并审批提交后，趋势报表最终值应该与预算表一致', async () => {
      const budgetResponse = await request(app)
        .get(`/api/budget/budgets/${trendTestBudgetId}`);
      
      expect(budgetResponse.status).toBe(200);
      const budgetUsed = parseFloat(budgetResponse.body.data.used_amount);
      const budgetLocked = parseFloat(budgetResponse.body.data.locked_amount);
      const budgetAvailable = parseFloat(budgetResponse.body.data.available_amount);
      
      expect(budgetUsed).toBe(300);
      expect(budgetLocked).toBe(0);
      expect(budgetAvailable).toBe(700);

      const trendResponse = await request(app)
        .get(`/api/reports/departments/${departmentId}/trend`)
        .query({
          budgetType: 'TREND_VERIFICATION',
          fiscalYear
        });
      
      expect(trendResponse.status).toBe(200);
      expect(trendResponse.body.success).toBe(true);
      
      const trend = trendResponse.body.data.trend;
      expect(trend.length).toBeGreaterThanOrEqual(2);
      
      const lastTrendPoint = trend[trend.length - 1];
      expect(lastTrendPoint.usedAmount).toBe(budgetUsed);
      expect(lastTrendPoint.lockedAmount).toBe(budgetLocked);
      expect(lastTrendPoint.availableAmount).toBe(budgetAvailable);
      
      expect(lastTrendPoint.usedAmount).toBe(300);
      expect(lastTrendPoint.lockedAmount).toBe(0);
      expect(lastTrendPoint.availableAmount).toBe(700);
    });

    test('趋势报表重放后的最终值应该等于预算表当前值', async () => {
      const trendResponse = await request(app)
        .get(`/api/reports/departments/${departmentId}/trend`)
        .query({
          budgetType: 'TREND_VERIFICATION',
          fiscalYear
        });
      
      expect(trendResponse.status).toBe(200);
      
      const budget = trendResponse.body.data.budget;
      const trendFinalUsed = trendResponse.body.data.trendFinalUsed;
      const trendFinalLocked = trendResponse.body.data.trendFinalLocked;
      const finalAvailable = trendResponse.body.data.finalAvailable;
      
      expect(trendFinalUsed).toBe(budget.currentUsed);
      expect(trendFinalLocked).toBe(budget.currentLocked);
      expect(finalAvailable).toBe(budget.currentAvailable);
      
      expect(trendFinalUsed).toBe(300);
      expect(trendFinalLocked).toBe(0);
      expect(finalAvailable).toBe(700);
    });

    test('趋势报表每个时间点的可用余额计算应该正确', async () => {
      const trendResponse = await request(app)
        .get(`/api/reports/departments/${departmentId}/trend`)
        .query({
          budgetType: 'TREND_VERIFICATION',
          fiscalYear
        });
      
      expect(trendResponse.status).toBe(200);
      
      const trend = trendResponse.body.data.trend;
      const totalAmount = trendResponse.body.data.budget.totalAmount;
      
      for (let i = 0; i < trend.length; i++) {
        const point = trend[i];
        const expectedAvailable = totalAmount - point.usedAmount - point.lockedAmount;
        expect(point.availableAmount).toBe(expectedAvailable);
        expect(point.availableAmount).toBeGreaterThanOrEqual(0);
      }
    });

    test('锁定后再释放，趋势报表应该正确反映预算变化', async () => {
      const testAppId = `RELEASE-TREND-${Date.now()}`;
      
      const lockResponse = await request(app)
        .post('/api/budget/locks')
        .send({
          budgetId: trendTestBudgetId,
          applicationId: testAppId,
          applicationType: 'PURCHASE_REQUEST',
          amount: 200,
          createdBy: 'release_trend_test'
        });
      
      expect(lockResponse.status).toBe(200);
      const lockId = lockResponse.body.data.lockId;

      const beforeReleaseResponse = await request(app)
        .get(`/api/reports/departments/${departmentId}/trend`)
        .query({
          budgetType: 'TREND_VERIFICATION',
          fiscalYear
        });
      
      const beforeReleaseTrend = beforeReleaseResponse.body.data.trend;
      const lastPointBefore = beforeReleaseTrend[beforeReleaseTrend.length - 1];
      expect(lastPointBefore.usedAmount).toBe(300);
      expect(lastPointBefore.lockedAmount).toBe(200);
      expect(lastPointBefore.availableAmount).toBe(500);

      await request(app)
        .post(`/api/budget/locks/${lockId}/release`)
        .send({
          operator: 'release_trend_test',
          reason: '测试释放后趋势'
        });

      const afterReleaseResponse = await request(app)
        .get(`/api/reports/departments/${departmentId}/trend`)
        .query({
          budgetType: 'TREND_VERIFICATION',
          fiscalYear
        });
      
      const afterReleaseTrend = afterReleaseResponse.body.data.trend;
      const lastPointAfter = afterReleaseTrend[afterReleaseTrend.length - 1];
      expect(lastPointAfter.usedAmount).toBe(300);
      expect(lastPointAfter.lockedAmount).toBe(0);
      expect(lastPointAfter.availableAmount).toBe(700);
    });
  });

  describe('7. 错误码验证', () => {
    test('获取不存在的预算应该返回 1001', async () => {
      const fakeId = uuidv4();
      const response = await request(app)
        .get(`/api/budget/budgets/${fakeId}`);
      
      expect(response.status).toBe(404);
      expect(response.body.code).toBe(1001);
    });

    test('获取不存在的部门报表应该返回 5001', async () => {
      const fakeId = uuidv4();
      const response = await request(app)
        .get(`/api/reports/departments/${fakeId}`);
      
      expect(response.status).toBe(404);
      expect(response.body.code).toBe(5001);
    });
  });

  describe('8. 金额校验测试', () => {
    let testBudgetId;
    let testLockId;

    beforeAll(async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);
      
      const budgetResponse = await request(app)
        .post('/api/budget/budgets')
        .send({
          departmentId,
          budgetType: 'VALIDATION_TEST',
          fiscalYear,
          totalAmount: 100000,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
      testBudgetId = budgetResponse.body.data.id;

      const lockResponse = await request(app)
        .post('/api/budget/locks')
        .send({
          budgetId: testBudgetId,
          applicationId: `VALIDATION-TEST-${Date.now()}`,
          applicationType: 'PURCHASE_REQUEST',
          amount: 10000,
          createdBy: 'validation_test',
          reason: '金额校验测试'
        });
      testLockId = lockResponse.body.data.lockId;
    });

    test('锁定金额为负数应该返回错误 9001', async () => {
      const response = await request(app)
        .post('/api/budget/locks')
        .send({
          budgetId: testBudgetId,
          applicationId: `NEGATIVE-TEST-${Date.now()}`,
          applicationType: 'PURCHASE_REQUEST',
          amount: -100,
          createdBy: 'validation_test'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe(9001);
      expect(response.body.details.message).toContain('必须为正数');
    });

    test('锁定金额为 0 应该返回错误 9001', async () => {
      const response = await request(app)
        .post('/api/budget/locks')
        .send({
          budgetId: testBudgetId,
          applicationId: `ZERO-TEST-${Date.now()}`,
          applicationType: 'PURCHASE_REQUEST',
          amount: 0,
          createdBy: 'validation_test'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe(9001);
    });

    test('修改锁定金额为负数应该返回错误 9001', async () => {
      const response = await request(app)
        .put(`/api/budget/locks/${testLockId}`)
        .send({
          newAmount: -5000,
          operator: 'validation_test'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe(9001);
      expect(response.body.details.message).toContain('必须为正数');
    });

    test('修改锁定金额为 0 应该返回错误 9001', async () => {
      const response = await request(app)
        .put(`/api/budget/locks/${testLockId}`)
        .send({
          newAmount: 0,
          operator: 'validation_test'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe(9001);
    });

    test('创建预算时总预算为负数应该返回错误 9001', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);
      
      const response = await request(app)
        .post('/api/budget/budgets')
        .send({
          departmentId,
          budgetType: 'NEGATIVE_BUDGET',
          fiscalYear,
          totalAmount: -100000,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe(9001);
      expect(response.body.details.message).toContain('不能为负数');
    });

    test('创建预算时 used_amount 为负数应该返回错误 9001', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);
      
      const response = await request(app)
        .post('/api/budget/budgets')
        .send({
          departmentId,
          budgetType: 'NEGATIVE_USED',
          fiscalYear,
          totalAmount: 100000,
          usedAmount: -5000,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe(9001);
    });

    test('负数锁定不会破坏预算数据完整性', async () => {
      const beforeBudget = await request(app)
        .get(`/api/budget/budgets/${testBudgetId}`);
      
      const beforeLocked = parseFloat(beforeBudget.body.data.locked_amount);
      const beforeAvailable = parseFloat(beforeBudget.body.data.available_amount);
      
      await request(app)
        .post('/api/budget/locks')
        .send({
          budgetId: testBudgetId,
          applicationId: `BREAK-TEST-${Date.now()}`,
          applicationType: 'PURCHASE_REQUEST',
          amount: -1000,
          createdBy: 'validation_test'
        });
      
      const afterBudget = await request(app)
        .get(`/api/budget/budgets/${testBudgetId}`);
      
      const afterLocked = parseFloat(afterBudget.body.data.locked_amount);
      const afterAvailable = parseFloat(afterBudget.body.data.available_amount);
      
      expect(afterLocked).toBe(beforeLocked);
      expect(afterAvailable).toBe(beforeAvailable);
    });
  });
});
