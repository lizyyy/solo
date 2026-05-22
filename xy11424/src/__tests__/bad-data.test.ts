import request from 'supertest';
import { createApp } from '../app';
import { PreparationStatus, UserRole } from '../types';

const authHeaders = {
  'x-user-id': 'test-admin-003',
  'x-user-name': 'TestAdmin3',
  'x-user-role': UserRole.ADMIN
};

describe('坏数据测试 - 验证失败的数据进入失败列表', () => {
  let app: any;
  let db: any;
  const badRequestId = `REQ-BAD-${Date.now()}`;

  beforeAll(() => {
    const result = createApp();
    app = result.app;
    db = result.db;
  });

  afterAll((done) => {
    db.close(done);
  });

  test('VIN码长度错误 - 验证失败', async () => {
    const response = await request(app)
      .post('/api/inspection')
      .set(authHeaders)
      .send({
        requestId: badRequestId,
        vin: 'SHORTVIN',
        plateNumber: '京C12345',
        brand: '奥迪',
        model: 'A6',
        year: 2020,
        mileage: 40000,
        inspectionDate: Date.now(),
        inspectorName: '王检测',
        items: [
          {
            code: 'INSP-001',
            name: '常规检查',
            description: '正常',
            severity: 'minor',
            estimatedCost: 100,
            isRequired: false
          }
        ],
        totalCost: 100,
        status: PreparationStatus.DRAFT,
        createdBy: 'test-admin-003',
        updatedBy: 'test-admin-003'
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.errors.length).toBeGreaterThan(0);
    expect(response.body.errors[0].field).toContain('vin');
  });

  test('总金额与明细不符 - 业务验证失败', async () => {
    const response = await request(app)
      .post('/api/inspection')
      .set(authHeaders)
      .send({
        requestId: `${badRequestId}-2`,
        vin: 'LBV1Z3108KM000003',
        plateNumber: '京C12346',
        brand: '奥迪',
        model: 'A6',
        year: 2020,
        mileage: 40000,
        inspectionDate: Date.now(),
        inspectorName: '王检测',
        items: [
          {
            code: 'INSP-001',
            name: '项目1',
            description: '测试',
            severity: 'minor',
            estimatedCost: 500,
            isRequired: true
          },
          {
            code: 'INSP-002',
            name: '项目2',
            description: '测试',
            severity: 'minor',
            estimatedCost: 300,
            isRequired: true
          }
        ],
        totalCost: 1000,
        status: PreparationStatus.DRAFT,
        createdBy: 'test-admin-003',
        updatedBy: 'test-admin-003'
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.errors[0].rule).toBe('business.totalCost.mismatch');
  });

  test('维修报价配件成本不匹配 - 业务验证失败', async () => {
    const response = await request(app)
      .post('/api/repair')
      .set(authHeaders)
      .send({
        requestId: `${badRequestId}-3`,
        vin: 'LBV1Z3108KM000004',
        plateNumber: '京C12347',
        brand: '奥迪',
        model: 'A6',
        year: 2020,
        mileage: 40000,
        quoteDate: Date.now(),
        repairShop: '测试汽修',
        quoteManager: '赵经理',
        items: [
          {
            code: 'REP-001',
            name: '配件1',
            description: '测试',
            partsCost: 200,
            laborCost: 100,
            quantity: 2
          }
        ],
        laborCost: 200,
        partsCost: 500,
        totalCost: 700,
        estimatedDuration: 1,
        status: PreparationStatus.DRAFT,
        createdBy: 'test-admin-003',
        updatedBy: 'test-admin-003'
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.errors[0].field).toBe('partsCost');
  });

  test('照片URL格式错误 - 验证失败', async () => {
    const response = await request(app)
      .post('/api/photo')
      .set(authHeaders)
      .send({
        requestId: `${badRequestId}-4`,
        vin: 'LBV1Z3108KM000005',
        plateNumber: '京C12348',
        photoDate: Date.now(),
        uploader: '孙拍照',
        photos: [
          {
            id: 'PIC-001',
            category: 'damage',
            url: 'not-a-valid-url',
            uploadTime: Date.now()
          }
        ],
        status: PreparationStatus.DRAFT,
        createdBy: 'test-admin-003',
        updatedBy: 'test-admin-003'
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('查看失败记录列表 - 坏数据都在列表中', async () => {
    const response = await request(app)
      .get('/api/failed')
      .set(authHeaders)
      .query({ resolved: 'false', page: 1, pageSize: 20 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.items.length).toBeGreaterThanOrEqual(4);
    
    const vinError = response.body.data.items.find(
      (item: any) => item.errorType === 'validation' && item.requestId === badRequestId
    );
    expect(vinError).toBeDefined();
    expect(vinError.resolved).toBe(false);
  });

  test('汇总报表不包含验证失败的数据', async () => {
    const response = await request(app)
      .get('/api/ledger')
      .set(authHeaders);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    
    for (const item of response.body.data.items) {
      expect(item.requestId).not.toBe(badRequestId);
    }
  });
});
