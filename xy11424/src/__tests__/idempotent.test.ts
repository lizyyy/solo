import request from 'supertest';
import { createApp } from '../app';
import { PreparationStatus, UserRole } from '../types';

const authHeaders = {
  'x-user-id': 'test-admin-002',
  'x-user-name': 'TestAdmin2',
  'x-user-role': UserRole.ADMIN
};

describe('幂等性测试 - 重复提交只更新同一条记录', () => {
  let app: any;
  let db: any;
  const testRequestId = `REQ-IDEMPOTENT-${Date.now()}`;
  const testVin = 'LBV1Z3108KM000002';

  beforeAll(() => {
    const result = createApp();
    app = result.app;
    db = result.db;
  });

  afterAll((done) => {
    db.close(done);
  });

  test('第一次提交检测单 - 创建新记录', async () => {
    const response = await request(app)
      .post('/api/inspection')
      .set(authHeaders)
      .send({
        requestId: testRequestId,
        vin: testVin,
        plateNumber: '京B12345',
        brand: '奔驰',
        model: 'E300',
        year: 2021,
        mileage: 30000,
        inspectionDate: Date.now(),
        inspectorName: '李检测',
        items: [
          {
            code: 'INSP-001',
            name: '刹车检查',
            description: '刹车片磨损',
            severity: 'major',
            estimatedCost: 2000,
            isRequired: true
          }
        ],
        totalCost: 2000,
        status: PreparationStatus.DRAFT,
        createdBy: 'test-admin-002',
        updatedBy: 'test-admin-002',
        changeReason: '初次提交'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.isUpdate).toBe(false);
    expect(response.body.data.totalCost).toBe(2000);
  });

  test('第二次提交相同requestId - 只更新，不新增', async () => {
    const response = await request(app)
      .post('/api/inspection')
      .set(authHeaders)
      .send({
        requestId: testRequestId,
        vin: testVin,
        plateNumber: '京B12345',
        brand: '奔驰',
        model: 'E300',
        year: 2021,
        mileage: 30000,
        inspectionDate: Date.now(),
        inspectorName: '李检测',
        items: [
          {
            code: 'INSP-001',
            name: '刹车检查',
            description: '刹车片磨损严重',
            severity: 'major',
            estimatedCost: 2500,
            isRequired: true
          },
          {
            code: 'INSP-002',
            name: '轮胎更换',
            description: '轮胎老化',
            severity: 'medium',
            estimatedCost: 1500,
            isRequired: true
          }
        ],
        totalCost: 4000,
        status: PreparationStatus.DRAFT,
        createdBy: 'test-admin-002',
        updatedBy: 'test-admin-002',
        changeReason: '补充检测项目'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.isUpdate).toBe(true);
    expect(response.body.data.totalCost).toBe(4000);
    expect(response.body.data.items.length).toBe(2);
  });

  test('查询确认只有一条记录', async () => {
    const response = await request(app)
      .get(`/api/ledger/${testRequestId}`)
      .set(authHeaders);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.inspectionOrder.totalCost).toBe(4000);
    expect(response.body.data.inspectionOrder.items.length).toBe(2);
  });

  test('审计日志包含两次操作记录', async () => {
    const response = await request(app)
      .get(`/api/ledger/${testRequestId}/audit`)
      .set(authHeaders);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    
    const createLog = response.body.data.find((log: any) => log.action === 'create');
    const updateLog = response.body.data.find((log: any) => log.action === 'update');
    
    expect(createLog).toBeDefined();
    expect(updateLog).toBeDefined();
    expect(updateLog.fieldChanges.length).toBeGreaterThan(0);
  });

  test('连续三次提交维修报价 - 始终只有一条记录', async () => {
    const quoteRequestId = `QUOTE-${Date.now()}`;
    
    for (let i = 1; i <= 3; i++) {
      const response = await request(app)
        .post('/api/repair')
        .set(authHeaders)
        .send({
          requestId: quoteRequestId,
          vin: testVin,
          plateNumber: '京B12345',
          brand: '奔驰',
          model: 'E300',
          year: 2021,
          mileage: 30000,
          quoteDate: Date.now(),
          repairShop: '奔驰专修',
          quoteManager: '王经理',
          items: [
            {
              code: 'REP-001',
              name: '刹车片更换',
              description: '前后刹车片',
              partsCost: 1000 * i,
              laborCost: 500,
              quantity: 1
            }
          ],
          laborCost: 500,
          partsCost: 1000 * i,
          totalCost: 1000 * i + 500,
          estimatedDuration: 1,
          status: PreparationStatus.DRAFT,
          createdBy: 'test-admin-002',
          updatedBy: 'test-admin-002',
          changeReason: `第${i}次报价`
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.isUpdate).toBe(i > 1);
    }

    const ledgerResponse = await request(app)
      .get(`/api/ledger/${quoteRequestId}`)
      .set(authHeaders);

    expect(ledgerResponse.body.data.repairQuote.totalCost).toBe(3500);
  });
});
