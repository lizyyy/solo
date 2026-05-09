import request from 'supertest';
import app from '../app';
import { User, Activity, Registration, StatusHistory } from '../models';
import { UserRole, ActivityStatus, RegistrationStatus } from '../types';
import './setup';

describe('Registration API', () => {
  let adminToken: string;
  let operatorToken: string;
  let testActivity: Activity;
  let testAdmin: User;
  let testOperator: User;

  beforeAll(async () => {
    testAdmin = await User.create({
      email: 'admin-test@example.com',
      password: 'admin123',
      name: '管理员',
      role: UserRole.ADMIN
    });

    testOperator = await User.create({
      email: 'operator-test@example.com',
      password: 'operator123',
      name: '运营',
      role: UserRole.OPERATOR
    });

    const adminLoginRes = await request(app).post('/api/auth/login').send({
      email: 'admin-test@example.com',
      password: 'admin123'
    });
    adminToken = adminLoginRes.body.data.token;

    const operatorLoginRes = await request(app).post('/api/auth/login').send({
      email: 'operator-test@example.com',
      password: 'operator123'
    });
    operatorToken = operatorLoginRes.body.data.token;
  });

  beforeEach(async () => {
    await Registration.destroy({ where: {}, force: true });
    await Activity.destroy({ where: {}, force: true });
    await StatusHistory.destroy({ where: {}, force: true });

    const now = new Date();
    testActivity = await Activity.create({
      name: '测试活动',
      description: '测试描述',
      location: '测试地点',
      startTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000),
      maxParticipants: 100,
      status: ActivityStatus.PUBLISHED,
      createdBy: testAdmin.id
    });
  });

  describe('POST /api/registrations', () => {
    it('应该成功创建报名记录', async () => {
      const res = await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          activityId: testActivity.id,
          name: '张三',
          email: 'zhangsan@example.com',
          phone: '13800138000',
          company: '测试公司'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('张三');
      expect(res.body.data.status).toBe(RegistrationStatus.PENDING);
    });

    it('应该创建状态历史记录', async () => {
      await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          activityId: testActivity.id,
          name: '李四',
          email: 'lisi@example.com'
        });

      const histories = await StatusHistory.findAll();
      expect(histories.length).toBeGreaterThan(0);
      expect(histories[0].newStatus).toBe(RegistrationStatus.PENDING);
    });

    it('应该拒绝重复报名', async () => {
      await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          activityId: testActivity.id,
          name: '王五',
          email: 'wangwu@example.com'
        });

      const res = await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          activityId: testActivity.id,
          name: '王五2',
          email: 'wangwu@example.com'
        });

      expect(res.status).toBe(409);
    });

    it('应该验证必填字段', async () => {
      const res = await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          activityId: testActivity.id
        });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/registrations/:id/status', () => {
    it('应该成功更新状态', async () => {
      const createRes = await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          activityId: testActivity.id,
          name: '赵六',
          email: 'zhaoliu@example.com'
        });

      const registrationId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/registrations/${registrationId}/status`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          status: RegistrationStatus.CONFIRMED,
          reason: '用户确认参加'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(RegistrationStatus.CONFIRMED);
    });

    it('应该记录状态变更历史', async () => {
      const createRes = await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          activityId: testActivity.id,
          name: '钱七',
          email: 'qianqi@example.com'
        });

      const registrationId = createRes.body.data.id;

      await request(app)
        .put(`/api/registrations/${registrationId}/status`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          status: RegistrationStatus.CONFIRMED
        });

      const histories = await StatusHistory.findAll({
        where: { registrationId }
      });

      expect(histories.length).toBe(2);
      expect(histories[0].newStatus).toBe(RegistrationStatus.PENDING);
      expect(histories[1].newStatus).toBe(RegistrationStatus.CONFIRMED);
    });

    it('应该拒绝无效的状态转换', async () => {
      const createRes = await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          activityId: testActivity.id,
          name: '孙八',
          email: 'sunba@example.com'
        });

      const registrationId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/registrations/${registrationId}/status`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          status: RegistrationStatus.COMPLETED
        });

      expect(res.status).toBe(400);
    });

    it('应该拒绝查看者更新状态', async () => {
      const viewer = await User.create({
        email: 'viewer-test@example.com',
        password: 'viewer123',
        name: '查看者',
        role: UserRole.VIEWER
      });

      const viewerLoginRes = await request(app).post('/api/auth/login').send({
        email: 'viewer-test@example.com',
        password: 'viewer123'
      });
      const viewerToken = viewerLoginRes.body.data.token;

      const createRes = await request(app)
        .post('/api/registrations')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          activityId: testActivity.id,
          name: '周九',
          email: 'zhoujiu@example.com'
        });

      const registrationId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/registrations/${registrationId}/status`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          status: RegistrationStatus.CONFIRMED
        });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/registrations/batch/status', () => {
    it('应该批量更新状态', async () => {
      const registrations: string[] = [];

      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/api/registrations')
          .set('Authorization', `Bearer ${operatorToken}`)
          .send({
            activityId: testActivity.id,
            name: `用户${i}`,
            email: `user${i}@example.com`
          });
        registrations.push(res.body.data.id);
      }

      const batchRes = await request(app)
        .post('/api/registrations/batch/status')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          ids: registrations,
          newStatus: RegistrationStatus.CONFIRMED
        });

      expect(batchRes.status).toBe(200);
      expect(batchRes.body.data.success).toBe(5);
    });
  });

  describe('GET /api/registrations/statistics', () => {
    it('应该返回统计信息', async () => {
      for (let i = 0; i < 10; i++) {
        await Registration.create({
          activityId: testActivity.id,
          name: `统计用户${i}`,
          email: `stats${i}@example.com`,
          status: i % 2 === 0 ? RegistrationStatus.CONFIRMED : RegistrationStatus.PENDING,
          createdBy: testOperator.id
        });
      }

      const res = await request(app)
        .get('/api/registrations/statistics')
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(10);
      expect(res.body.data.byStatus.length).toBeGreaterThan(0);
    });
  });
});
