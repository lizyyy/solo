import request from 'supertest';
import { createApp } from '../app';
import { PreparationStatus, UserRole } from '../types';

describe('角色权限和脱敏测试', () => {
  let app: any;
  let db: any;
  const testRequestId = `REQ-SEC-${Date.now()}`;
  const testVin = 'LBV1Z3108KM000006';

  const adminHeaders = {
    'x-user-id': 'admin-001',
    'x-user-name': 'AdminUser',
    'x-user-role': UserRole.ADMIN
  };

  const financialHeaders = {
    'x-user-id': 'finance-001',
    'x-user-name': 'FinanceUser',
    'x-user-role': UserRole.FINANCIAL
  };

  beforeAll(async () => {
    const result = createApp();
    app = result.app;
    db = result.db;

    await request(app)
      .post('/api/inspection')
      .set(adminHeaders)
      .send({
        requestId: testRequestId,
        vin: testVin,
        plateNumber: '京D12345',
        brand: '丰田',
        model: '凯美瑞',
        year: 2019,
        mileage: 60000,
        inspectionDate: Date.now(),
        inspectorName: '张检测员',
        items: [
          {
            code: 'INSP-001',
            name: '常规检查',
            description: '正常',
            severity: 'minor',
            estimatedCost: 200,
            isRequired: false
          }
        ],
        totalCost: 200,
        status: PreparationStatus.DRAFT,
        createdBy: 'admin-001',
        updatedBy: 'admin-001',
        remarks: '这是一条敏感的备注信息'
      });
  });

  afterAll((done) => {
    db.close(done);
  });

  test('管理员可以看到完整的敏感字段', async () => {
    const response = await request(app)
      .get(`/api/inspection/${testRequestId}`)
      .set(adminHeaders);

    expect(response.status).toBe(200);
    expect(response.body.data.inspectorName).toBe('张检测员');
    expect(response.body.data.remarks).toBe('这是一条敏感的备注信息');
  });

  test('财务人员看到的敏感字段被脱敏', async () => {
    const response = await request(app)
      .get(`/api/inspection/${testRequestId}`)
      .set(financialHeaders);

    expect(response.status).toBe(200);
    expect(response.body.data.inspectorName).not.toBe('张检测员');
    expect(response.body.data.inspectorName).toContain('*');
    expect(response.body.data.remarks).not.toBe('这是一条敏感的备注信息');
  });

  test('财务人员没有编辑权限', async () => {
    const response = await request(app)
      .post('/api/inspection')
      .set(financialHeaders)
      .send({
        requestId: testRequestId,
        vin: testVin,
        plateNumber: '京D12345',
        brand: '丰田',
        model: '凯美瑞',
        year: 2019,
        mileage: 60000,
        inspectionDate: Date.now(),
        inspectorName: '李检测',
        items: [
          {
            code: 'INSP-001',
            name: '常规检查',
            description: '正常',
            severity: 'minor',
            estimatedCost: 200,
            isRequired: false
          }
        ],
        totalCost: 200,
        status: PreparationStatus.DRAFT,
        createdBy: 'finance-001',
        updatedBy: 'finance-001'
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('无编辑权限');
  });

  test('财务人员可以导出数据', async () => {
    const response = await request(app)
      .get('/api/ledger/export/csv')
      .set(financialHeaders);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('csv');
  });

  test('财务人员没有审计权限', async () => {
    const response = await request(app)
      .get(`/api/ledger/${testRequestId}/audit`)
      .set(financialHeaders);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('无审计权限');
  });

  test('管理员有审计权限', async () => {
    const response = await request(app)
      .get(`/api/ledger/${testRequestId}/audit`)
      .set(adminHeaders);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test('缺少认证信息返回401', async () => {
    const response = await request(app)
      .get('/api/ledger');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('缺少认证信息');
  });
});
