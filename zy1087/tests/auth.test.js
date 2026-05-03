const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const db = require('../src/db');

describe('Authentication API', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: '测试用户',
          email: 'test@example.com',
          password: 'Test1234!',
          phone: '13800138999'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.password_hash).toBeUndefined();
    });

    it('should return 409 if email already exists', async () => {
      await db('users').insert({
        name: '已存在用户',
        email: 'existing@example.com',
        password_hash: bcrypt.hashSync('Test1234!', 10)
      });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: '新用户',
          email: 'existing@example.com',
          password: 'Test1234!'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('邮箱');
    });

    it('should return 400 for invalid password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: '测试用户',
          email: 'test2@example.com',
          password: 'weak'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test3@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      const passwordHash = bcrypt.hashSync('Secure123!', 10);
      await db('users').insert({
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: '登录用户',
        email: 'login@example.com',
        password_hash: passwordHash,
        phone: '13800138001'
      });
    });

    it('should login with correct credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'Secure123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe('login@example.com');
      expect(response.body.data.token).toBeDefined();
    });

    it('should return 401 for wrong password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 for non-existent email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Secure123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let authToken;

    beforeEach(async () => {
      const passwordHash = bcrypt.hashSync('Secure123!', 10);
      await db('users').insert({
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: '当前用户',
        email: 'current@example.com',
        password_hash: passwordHash,
        phone: '13800138002'
      });

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'current@example.com',
          password: 'Secure123!'
        });

      authToken = loginResponse.body.data.token;
    });

    it('should get current user with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('current@example.com');
      expect(response.body.data.password_hash).toBeUndefined();
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalidtoken');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/auth/me', () => {
    let authToken;

    beforeEach(async () => {
      const passwordHash = bcrypt.hashSync('Secure123!', 10);
      await db('users').insert({
        id: '550e8400-e29b-41d4-a716-446655440003',
        name: '更新用户',
        email: 'update@example.com',
        password_hash: passwordHash,
        phone: '13800138003'
      });

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'update@example.com',
          password: 'Secure123!'
        });

      authToken = loginResponse.body.data.token;
    });

    it('should update user name', async () => {
      const response = await request(app)
        .put('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '更新后的用户名'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('更新后的用户名');
    });

    it('should update phone number', async () => {
      const response = await request(app)
        .put('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          phone: '13900139000'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.phone).toBe('13900139000');
    });
  });
});
