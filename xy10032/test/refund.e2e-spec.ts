import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { RefundStatus } from '../src/common/enums/refund-status.enum';

describe('RefundController (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let operatorToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    await app.init();

    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password123' });
    adminToken = adminLogin.body.data.accessToken;

    const operatorLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'operator', password: 'password123' });
    operatorToken = operatorLogin.body.data.accessToken;

    const viewerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'viewer', password: 'password123' });
    viewerToken = viewerLogin.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/refunds', () => {
    it('should create refund as operator', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/refunds')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          orderNo: `E2E_${Date.now()}`,
          amount: 199.99,
          reason: 'Test refund',
        })
        .expect(201);

      expect(response.body.data.status).toBe(RefundStatus.DRAFT);
      expect(response.body.data.refundNo).toBeDefined();
    });

    it('should fail to create refund as viewer', async () => {
      await request(app.getHttpServer())
        .post('/api/refunds')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          orderNo: `E2E_VIEWER_${Date.now()}`,
          amount: 99.99,
          reason: 'Test',
        })
        .expect(403);
    });

    it('should fail with validation errors', async () => {
      await request(app.getHttpServer())
        .post('/api/refunds')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          orderNo: '',
          amount: -100,
        })
        .expect(400);
    });
  });

  describe('GET /api/refunds', () => {
    it('should list refunds as operator', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/refunds')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(response.body.data.items).toBeDefined();
      expect(response.body.data.total).toBeDefined();
    });

    it('should list refunds as viewer', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/refunds')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(response.body.data.items).toBeDefined();
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/refunds?page=1&limit=5')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(5);
    });

    it('should filter by status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/refunds?status=${RefundStatus.SUCCESS}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      for (const refund of response.body.data.items) {
        expect(refund.status).toBe(RefundStatus.SUCCESS);
      }
    });
  });

  describe('GET /api/refunds/:id', () => {
    let refundId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/refunds')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          orderNo: `E2E_GET_${Date.now()}`,
          amount: 299.99,
          reason: 'Test for get',
        });
      refundId = response.body.data.id;
    });

    it('should get single refund', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/refunds/${refundId}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(response.body.data.id).toBe(refundId);
    });

    it('should return 404 for non-existent refund', async () => {
      await request(app.getHttpServer())
        .get('/api/refunds/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(404);
    });
  });

  describe('POST /api/refunds/:id/transition', () => {
    let refundId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/refunds')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          orderNo: `E2E_TRANS_${Date.now()}`,
          amount: 159.99,
          reason: 'Test for transition',
        });
      refundId = response.body.data.id;
    });

    it('should submit draft to pending as operator', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/refunds/${refundId}/transition`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          targetStatus: RefundStatus.PENDING,
          reason: 'Submitted for approval',
        })
        .expect(201);

      expect(response.body.data.status).toBe(RefundStatus.PENDING);
    });

    it('should approve pending as admin', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/refunds/${refundId}/transition`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          targetStatus: RefundStatus.PROCESSING,
        })
        .expect(201);

      expect(response.body.data.status).toBe(RefundStatus.PROCESSING);
    });

    it('should fail for operator to approve', async () => {
      const draftResponse = await request(app.getHttpServer())
        .post('/api/refunds')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          orderNo: `E2E_NO_PERM_${Date.now()}`,
          amount: 100,
          reason: 'Test',
        });

      await request(app.getHttpServer())
        .post(`/api/refunds/${draftResponse.body.data.id}/transition`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          targetStatus: RefundStatus.PENDING,
        });

      await request(app.getHttpServer())
        .post(`/api/refunds/${draftResponse.body.data.id}/transition`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          targetStatus: RefundStatus.PROCESSING,
        })
        .expect(403);
    });
  });

  describe('GET /api/refunds/statistics', () => {
    it('should get statistics as admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/refunds/statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.total).toBeDefined();
      expect(response.body.data.byStatus).toBeDefined();
      expect(response.body.data.totalAmount).toBeDefined();
    });

    it('should fail for viewer', async () => {
      await request(app.getHttpServer())
        .get('/api/refunds/statistics')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);
    });
  });

  describe('GET /api/refunds/:id/history', () => {
    let refundId: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/refunds')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          orderNo: `E2E_HISTORY_${Date.now()}`,
          amount: 99.99,
          reason: 'Test for history',
        });
      refundId = response.body.data.id;
    });

    it('should get refund history', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/refunds/${refundId}/history`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
