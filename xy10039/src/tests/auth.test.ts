import request from 'supertest';
import app from '../app';
import { User } from '../models';
import { sequelize } from '../config/database';
import { UserRole } from '../types';
import './setup';

describe('Auth API', () => {
  let testUser: User;

  beforeEach(async () => {
    await sequelize.sync({ force: true });

    testUser = await User.create({
      email: 'test@example.com',
      password: 'password123',
      name: '测试用户',
      role: UserRole.OPERATOR
    });
  });

  describe('POST /api/auth/register', () => {
    it('应该成功注册新用户', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'new@example.com',
        password: 'password123',
        name: '新用户'
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('new@example.com');
    });

    it('应该拒绝重复邮箱注册', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'password123',
        name: '测试用户'
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('应该验证邮箱格式', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'invalid-email',
        password: 'password123',
        name: '测试用户'
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('应该验证密码长度', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'test2@example.com',
        password: '123',
        name: '测试用户'
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('应该成功登录并返回token', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'password123'
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe('test@example.com');
    });

    it('应该拒绝错误的密码', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'wrongpassword'
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('应该拒绝不存在的用户', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'password123'
      });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/profile', () => {
    it('应该获取当前用户信息', async () => {
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'password123'
      });

      const token = loginRes.body.data.token;

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('test@example.com');
    });

    it('应该拒绝未认证的请求', async () => {
      const res = await request(app).get('/api/auth/profile');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('应该拒绝无效的token', async () => {
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
