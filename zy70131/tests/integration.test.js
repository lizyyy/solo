const request = require('supertest');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const app = require('../src/app');
const sequelize = require('../src/config/database');
const { Material, MaterialStatus } = require('../src/models/Material');
const { Authorization, AuthorizationStatus } = require('../src/models/Authorization');

describe('Integration Tests', () => {
  let testMaterial;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    testMaterial = await Material.create({
      id: uuidv4(),
      materialCode: 'TEST-MAT-001',
      materialName: '集成测试素材',
      materialType: 'video',
      copyrightOwner: '测试版权方',
      status: MaterialStatus.ACTIVE,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Materials API', () => {
    test('GET /api/v1/materials 应返回素材列表', async () => {
      const response = await request(app).get('/api/v1/materials');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBeGreaterThanOrEqual(1);
    });

    test('POST /api/v1/materials 应创建新素材', async () => {
      const response = await request(app)
        .post('/api/v1/materials')
        .send({
          materialCode: 'TEST-MAT-002',
          materialName: '新建测试素材',
          materialType: 'image',
          copyrightOwner: '新版权方'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.materialCode).toBe('TEST-MAT-002');
    });

    test('POST /api/v1/materials/:id/authorizations 应为素材创建授权', async () => {
      const response = await request(app)
        .post(`/api/v1/materials/${testMaterial.id}/authorizations`)
        .send({
          authorizationCode: 'INT-AUTH-001',
          channelId: uuidv4(),
          channelName: '集成测试渠道',
          scope: 'full',
          effectiveDate: dayjs().subtract(1, 'day').toISOString(),
          expirationDate: dayjs().add(30, 'day').toISOString(),
          regionRules: [
            {
              ruleType: 'include',
              regionCode: 'CN',
              regionName: '中国',
              priority: 10
            }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    test('POST /api/v1/materials/:id/evaluate 应评估素材授权有效性', async () => {
      const response = await request(app)
        .post(`/api/v1/materials/${testMaterial.id}/evaluate`)
        .send({
          regionCode: 'CN'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.evaluations.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Authorizations API', () => {
    let testAuth;

    beforeAll(async () => {
      testAuth = await Authorization.create({
        id: uuidv4(),
        authorizationCode: 'INT-AUTH-002',
        materialId: testMaterial.id,
        channelId: uuidv4(),
        channelName: '撤销测试渠道',
        scope: 'full',
        effectiveDate: dayjs().subtract(1, 'day').toDate(),
        expirationDate: dayjs().add(30, 'day').toDate(),
        status: AuthorizationStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    test('POST /api/v1/authorizations/:id/revoke 应撤销授权并触发下架', async () => {
      const response = await request(app)
        .post(`/api/v1/authorizations/${testAuth.id}/revoke`)
        .send({
          revokedBy: 'test-user',
          revocationReason: '测试撤销授权'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('COMPLETED');
    });

    test('已撤销的授权再次撤销应返回错误', async () => {
      const response = await request(app)
        .post(`/api/v1/authorizations/${testAuth.id}/revoke`)
        .send({
          revokedBy: 'test-user'
        });

      expect(response.status).toBe(500);
    });

    test('GET /api/v1/authorizations/:id/evaluation-history 应返回评估历史', async () => {
      const response = await request(app)
        .get(`/api/v1/authorizations/${testAuth.id}/evaluation-history`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Removals API', () => {
    let expiredAuth;

    beforeAll(async () => {
      expiredAuth = await Authorization.create({
        id: uuidv4(),
        authorizationCode: 'INT-AUTH-EXPIRED',
        materialId: testMaterial.id,
        channelId: uuidv4(),
        channelName: '已到期授权',
        scope: 'full',
        effectiveDate: dayjs().subtract(30, 'day').toDate(),
        expirationDate: dayjs().subtract(1, 'day').toDate(),
        status: AuthorizationStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    test('POST /api/v1/removals/process-expired 应处理已到期授权', async () => {
      const response = await request(app)
        .post('/api/v1/removals/process-expired');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.processed).toBeGreaterThanOrEqual(1);
    });

    test('GET /api/v1/removals 应返回下架记录列表', async () => {
      const response = await request(app).get('/api/v1/removals');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Notifications API', () => {
    test('POST /api/v1/notifications/send-expiration-warnings 应发送到期预警', async () => {
      await Authorization.create({
        id: uuidv4(),
        authorizationCode: 'INT-AUTH-WARNING',
        materialId: testMaterial.id,
        channelId: uuidv4(),
        channelName: '预警测试渠道',
        scope: 'full',
        effectiveDate: dayjs().subtract(30, 'day').toDate(),
        expirationDate: dayjs().add(5, 'day').toDate(),
        status: AuthorizationStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const response = await request(app)
        .post('/api/v1/notifications/send-expiration-warnings')
        .send({
          daysThreshold: 7,
          recipient: 'test@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
