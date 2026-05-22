import request from 'supertest';
import { createApp } from '../app';
import { PreparationStatus, UserRole, RecordSource } from '../types';

const authHeaders = {
  'x-user-id': 'test-admin-001',
  'x-user-name': 'TestAdmin',
  'x-user-role': UserRole.ADMIN
};

describe('正常流程测试', () => {
  let app: any;
  let db: any;
  const testRequestId = `REQ-${Date.now()}`;
  const testVin = 'LBV1Z3108KM000001';

  beforeAll(() => {
    const result = createApp();
    app = result.app;
    db = result.db;
  });

  afterAll((done) => {
    db.close(done);
  });

  test('健康检查接口', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test('提交检测单 - 草稿状态', async () => {
    const response = await request(app)
      .post('/api/inspection')
      .set(authHeaders)
      .send({
        requestId: testRequestId,
        vin: testVin,
        plateNumber: '京A12345',
        brand: '宝马',
        model: 'X5',
        year: 2020,
        mileage: 50000,
        inspectionDate: Date.now(),
        inspectorName: '张检测',
        items: [
          {
            code: 'INSP-001',
            name: '外观检查',
            description: '车漆多处划痕',
            severity: 'minor',
            estimatedCost: 500,
            isRequired: true
          },
          {
            code: 'INSP-002',
            name: '机油更换',
            description: '需要更换机油',
            severity: 'medium',
            estimatedCost: 800,
            isRequired: true
          }
        ],
        totalCost: 1300,
        status: PreparationStatus.DRAFT,
        remarks: '初步检测',
        createdBy: 'test-admin-001',
        updatedBy: 'test-admin-001',
        changeReason: '创建检测单草稿'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.isUpdate).toBe(false);
    expect(response.body.data.status).toBe(PreparationStatus.DRAFT);
    expect(response.body.data.totalCost).toBe(1300);
  });

  test('提交维修报价', async () => {
    const response = await request(app)
      .post('/api/repair')
      .set(authHeaders)
      .send({
        requestId: testRequestId,
        vin: testVin,
        plateNumber: '京A12345',
        brand: '宝马',
        model: 'X5',
        year: 2020,
        mileage: 50000,
        quoteDate: Date.now(),
        repairShop: '诚信汽修',
        quoteManager: '李经理',
        items: [
          {
            code: 'REP-001',
            name: '车漆修复',
            description: '全车车漆抛光+局部补漆',
            partsCost: 300,
            laborCost: 200,
            quantity: 1
          },
          {
            code: 'REP-002',
            name: '机油三滤',
            description: '更换机油机滤空滤',
            partsCost: 500,
            laborCost: 100,
            quantity: 1
          }
        ],
        laborCost: 300,
        partsCost: 800,
        totalCost: 1100,
        estimatedDuration: 3,
        status: PreparationStatus.DRAFT,
        remarks: '初步报价',
        createdBy: 'test-admin-001',
        updatedBy: 'test-admin-001',
        changeReason: '创建维修报价草稿'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.isUpdate).toBe(false);
    expect(response.body.data.status).toBe(PreparationStatus.DRAFT);
  });

  test('提交照片清单', async () => {
    const response = await request(app)
      .post('/api/photo')
      .set(authHeaders)
      .send({
        requestId: testRequestId,
        vin: testVin,
        plateNumber: '京A12345',
        photoDate: Date.now(),
        uploader: '王拍照',
        photos: [
          {
            id: 'PIC-001',
            category: 'damage',
            url: 'https://example.com/photo1.jpg',
            description: '右前保险杠划痕',
            uploadTime: Date.now()
          },
          {
            id: 'PIC-002',
            category: 'interior',
            url: 'https://example.com/photo2.jpg',
            description: '内饰全景',
            uploadTime: Date.now()
          }
        ],
        status: PreparationStatus.DRAFT,
        remarks: '现场照片',
        createdBy: 'test-admin-001',
        updatedBy: 'test-admin-001',
        changeReason: '上传照片清单'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.isUpdate).toBe(false);
    expect(response.body.data.photos.length).toBe(2);
  });

  test('检测单状态流转：草稿 -> 已提交', async () => {
    const response = await request(app)
      .post(`/api/inspection/${testRequestId}/status`)
      .set(authHeaders)
      .send({
        newStatus: PreparationStatus.SUBMITTED,
        changeReason: '检测完成，提交审核'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test('获取台账详情', async () => {
    const response = await request(app)
      .get(`/api/ledger/${testRequestId}`)
      .set(authHeaders);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.requestId).toBe(testRequestId);
    expect(response.body.data.inspectionOrder).toBeDefined();
    expect(response.body.data.repairQuote).toBeDefined();
    expect(response.body.data.photoInventory).toBeDefined();
    expect(response.body.data.totalInspectionCost).toBe(1300);
    expect(response.body.data.totalRepairCost).toBe(1100);
    expect(response.body.data.photoCount).toBe(2);
    expect(response.body.data.auditTrail.length).toBeGreaterThan(0);
  });

  test('获取台账列表', async () => {
    const response = await request(app)
      .get('/api/ledger')
      .set(authHeaders)
      .query({ page: 1, pageSize: 10 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.items.length).toBeGreaterThan(0);
    expect(response.body.data.total).toBeGreaterThan(0);
  });

  test('获取汇总报表', async () => {
    const response = await request(app)
      .get('/api/ledger/summary')
      .set(authHeaders);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.totalRecords).toBeGreaterThan(0);
    expect(response.body.data.totalInspectionCost).toBeGreaterThan(0);
    expect(response.body.data.totalRepairCost).toBeGreaterThan(0);
  });

  test('导出台账CSV', async () => {
    const response = await request(app)
      .get('/api/ledger/export/csv')
      .set(authHeaders);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('csv');
    expect(response.text).toContain('请求ID');
    expect(response.text).toContain('车架号');
  });

  test('获取审计日志', async () => {
    const response = await request(app)
      .get(`/api/ledger/${testRequestId}/audit`)
      .set(authHeaders);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
    
    const statusChangeLog = response.body.data.find((log: any) => log.action === 'status_change');
    expect(statusChangeLog).toBeDefined();
    expect(statusChangeLog.oldStatus).toBe(PreparationStatus.DRAFT);
    expect(statusChangeLog.newStatus).toBe(PreparationStatus.SUBMITTED);
  });
});
