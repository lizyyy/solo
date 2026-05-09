import request from 'supertest';
import app from '../src/index';
import prisma from '../src/config/prisma';
import bcrypt from 'bcryptjs';
import { RefundStatus, RefundReason, Role } from '@prisma/client';

describe('退款管理测试', () => {
  let adminToken: string;
  let managerToken: string;
  let operatorToken: string;
  let adminUser: any;
  let managerUser: any;
  let operatorUser: any;
  let testRefund: any;

  beforeAll(async () => {
    await prisma.$connect();

    const passwordHash = await bcrypt.hash('password123', 12);

    [adminUser, managerUser, operatorUser] = await Promise.all([
      prisma.user.create({
        data: {
          username: 'testadmin',
          email: 'testadmin@example.com',
          passwordHash,
          role: 'ADMIN'
        }
      }),
      prisma.user.create({
        data: {
          username: 'testmanager',
          email: 'testmanager@example.com',
          passwordHash,
          role: 'MANAGER'
        }
      }),
      prisma.user.create({
        data: {
          username: 'testoperator',
          email: 'testoperator@example.com',
          passwordHash,
          role: 'OPERATOR'
        }
      })
    ]);

    [adminToken, managerToken, operatorToken] = await Promise.all([
      request(app)
        .post('/api/auth/login')
        .send({ username: 'testadmin', password: 'password123' })
        .then(r => r.body.data.token),
      request(app)
        .post('/api/auth/login')
        .send({ username: 'testmanager', password: 'password123' })
        .then(r => r.body.data.token),
      request(app)
        .post('/api/auth/login')
        .send({ username: 'testoperator', password: 'password123' })
        .then(r => r.body.data.token)
    ]);
  });

  afterAll(async () => {
    await prisma.refundLog.deleteMany({
      where: { refund: { orderNo: { startsWith: 'TEST' } } }
    });
    await prisma.refundStatusHistory.deleteMany({
      where: { refund: { orderNo: { startsWith: 'TEST' } } }
    });
    await prisma.refund.deleteMany({
      where: { orderNo: { startsWith: 'TEST' } }
    });
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'test' } }
    });
    await prisma.$disconnect();
  });

  describe('退款单CRUD', () => {
    it('应该创建退款单', async () => {
      const response = await request(app)
        .post('/api/refunds')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          orderNo: 'TEST001',
          customerName: '测试用户',
          customerPhone: '13800138000',
          amount: 299.99,
          reason: RefundReason.QUALITY_ISSUE,
          reasonDetail: '测试退款原因',
          paymentMethod: 'BANK_TRANSFER'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(RefundStatus.DRAFT);
      expect(response.body.data.refundNo).toBeDefined();
      expect(response.body.data.version).toBe(1);

      testRefund = response.body.data;
    });

    it('应该拒绝重复订单号的退款单', async () => {
      const response = await request(app)
        .post('/api/refunds')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          orderNo: 'TEST001',
          customerName: '测试用户2',
          amount: 199.99,
          reason: RefundReason.OTHER
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it('应该拒绝无效的退款金额', async () => {
      const response = await request(app)
        .post('/api/refunds')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          orderNo: 'TEST002',
          customerName: '测试用户',
          amount: -100,
          reason: RefundReason.OTHER
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    it('应该获取退款单详情', async () => {
      const response = await request(app)
        .get(`/api/refunds/${testRefund.id}`)
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testRefund.id);
      expect(response.body.data.statusHistories).toBeDefined();
      expect(response.body.data.logs).toBeDefined();
    });

    it('应该更新退款单', async () => {
      const response = await request(app)
        .put(`/api/refunds/${testRefund.id}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          customerName: '更新后的用户名',
          amount: 399.99
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.customerName).toBe('更新后的用户名');
      expect(Number(response.body.data.amount)).toBe(399.99);
      expect(response.body.data.version).toBe(2);
    });

    it('应该获取退款单列表', async () => {
      const response = await request(app)
        .get('/api/refunds')
        .set('Authorization', `Bearer ${operatorToken}`)
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('状态流转测试', () => {
    let refundId: string;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/refunds')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          orderNo: 'TEST_STATE',
          customerName: '状态测试用户',
          amount: 500,
          reason: RefundReason.QUALITY_ISSUE
        });
      refundId = response.body.data.id;
    });

    it('DRAFT -> PENDING_REVIEW (操作员)', async () => {
      const response = await request(app)
        .post(`/api/refunds/${refundId}/submit`)
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe(RefundStatus.PENDING_REVIEW);
    });

    it('PENDING_REVIEW -> APPROVED (经理)', async () => {
      const response = await request(app)
        .post(`/api/refunds/${refundId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ reason: '审核通过' });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe(RefundStatus.APPROVED);
    });

    it('APPROVED -> PROCESSING (操作员)', async () => {
      const response = await request(app)
        .post(`/api/refunds/${refundId}/process`)
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe(RefundStatus.PROCESSING);
    });

    it('PROCESSING -> SUCCESS (操作员)', async () => {
      const response = await request(app)
        .post(`/api/refunds/${refundId}/success`)
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe(RefundStatus.SUCCESS);
    });

    it('应该拒绝从SUCCESS进行状态转换', async () => {
      const response = await request(app)
        .post(`/api/refunds/${refundId}/process`)
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('应该获取状态历史', async () => {
      const response = await request(app)
        .get(`/api/refunds/${refundId}/history`)
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('应该获取操作日志', async () => {
      const response = await request(app)
        .get(`/api/refunds/${refundId}/logs`)
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('失败重试测试', () => {
    let failedRefundId: string;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/refunds')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          orderNo: 'TEST_RETRY',
          customerName: '重试测试',
          amount: 100,
          reason: RefundReason.OTHER
        });

      let id = response.body.data.id;
      
      await request(app)
        .post(`/api/refunds/${id}/submit`)
        .set('Authorization', `Bearer ${operatorToken}`);
      
      await request(app)
        .post(`/api/refunds/${id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);
      
      await request(app)
        .post(`/api/refunds/${id}/process`)
        .set('Authorization', `Bearer ${operatorToken}`);

      const failResponse = await request(app)
        .post(`/api/refunds/${id}/fail`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ errorMessage: '银行接口超时' });

      failedRefundId = failResponse.body.data.id;
    });

    it('FAILED状态应该可以重试', async () => {
      const response = await request(app)
        .post(`/api/refunds/${failedRefundId}/retry`)
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe(RefundStatus.PROCESSING);
    });
  });

  describe('权限测试', () => {
    let refundForPermissionTest: any;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/refunds')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          orderNo: 'TEST_PERMISSION',
          customerName: '权限测试',
          amount: 200,
          reason: RefundReason.OTHER
        });
      refundForPermissionTest = response.body.data;

      await request(app)
        .post(`/api/refunds/${refundForPermissionTest.id}/submit`)
        .set('Authorization', `Bearer ${operatorToken}`);
    });

    it('操作员不能审核退款单', async () => {
      const response = await request(app)
        .post(`/api/refunds/${refundForPermissionTest.id}/approve`)
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(response.status).toBe(403);
    });

    it('经理可以审核退款单', async () => {
      const response = await request(app)
        .post(`/api/refunds/${refundForPermissionTest.id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe(RefundStatus.APPROVED);
    });
  });

  describe('批量操作测试', () => {
    it('应该执行批量提交审核', async () => {
      const refunds = await Promise.all([
        request(app)
          .post('/api/refunds')
          .set('Authorization', `Bearer ${operatorToken}`)
          .send({
            orderNo: 'TEST_BATCH1',
            customerName: '批量1',
            amount: 100,
            reason: RefundReason.OTHER
          }),
        request(app)
          .post('/api/refunds')
          .set('Authorization', `Bearer ${operatorToken}`)
          .send({
            orderNo: 'TEST_BATCH2',
            customerName: '批量2',
            amount: 200,
            reason: RefundReason.OTHER
          }),
        request(app)
          .post('/api/refunds')
          .set('Authorization', `Bearer ${operatorToken}`)
          .send({
            orderNo: 'TEST_BATCH3',
            customerName: '批量3',
            amount: 300,
            reason: RefundReason.OTHER
          })
      ]);

      const refundIds = refunds.map(r => r.body.data.id);

      const response = await request(app)
        .post('/api/refunds/batch')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          refundIds,
          action: 'submit'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.success).toBe(3);
    });
  });

  describe('统计测试', () => {
    it('应该获取统计数据', async () => {
      const response = await request(app)
        .get('/api/refunds/statistics')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.byStatus).toBeDefined();
      expect(response.body.data.todayCount).toBeDefined();
    });
  });
});
