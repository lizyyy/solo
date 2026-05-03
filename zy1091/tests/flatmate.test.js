const request = require('supertest');
const app = require('../src/app');
const { Flatmate } = require('../src/models');
const { createTestFlatmates } = require('./setup');

describe('Flatmate API', () => {
  describe('GET /api/v1/flatmates', () => {
    it('should return empty array when no flatmates exist', async () => {
      const res = await request(app).get('/api/v1/flatmates');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.flatmates).toBeDefined();
      expect(Array.isArray(res.body.data.flatmates)).toBe(true);
    });

    it('should return all active flatmates', async () => {
      await createTestFlatmates();
      
      const res = await request(app).get('/api/v1/flatmates');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.flatmates.length).toBe(3);
    });
  });

  describe('POST /api/v1/flatmates', () => {
    it('should create a new flatmate', async () => {
      const flatmateData = {
        name: '新室友',
        email: 'new@example.com',
        phone: '13800138999',
        is_admin: false,
      };
      
      const res = await request(app)
        .post('/api/v1/flatmates')
        .send(flatmateData);
      
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.flatmate.name).toBe('新室友');
      expect(res.body.data.flatmate.email).toBe('new@example.com');
    });

    it('should return error when name is missing', async () => {
      const res = await request(app)
        .post('/api/v1/flatmates')
        .send({
          email: 'test@example.com',
        });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should not allow duplicate active flatmate names', async () => {
      await Flatmate.create({
        name: '重复名字',
        email: 'first@example.com',
        status: 'active',
      });
      
      const res = await request(app)
        .post('/api/v1/flatmates')
        .send({
          name: '重复名字',
          email: 'second@example.com',
        });
      
      expect(res.statusCode).toBe(409);
    });
  });

  describe('GET /api/v1/flatmates/:id', () => {
    it('should return flatmate by id', async () => {
      const flatmate = await Flatmate.create({
        name: '测试用户',
        email: 'test@example.com',
        status: 'active',
      });
      
      const res = await request(app).get(`/api/v1/flatmates/${flatmate.id}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.flatmate.name).toBe('测试用户');
    });

    it('should return 404 for non-existent flatmate', async () => {
      const res = await request(app).get('/api/v1/flatmates/99999');
      
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /api/v1/flatmates/:id', () => {
    it('should update flatmate info', async () => {
      const flatmate = await Flatmate.create({
        name: '旧名字',
        email: 'old@example.com',
        status: 'active',
      });
      
      const res = await request(app)
        .put(`/api/v1/flatmates/${flatmate.id}`)
        .send({
          name: '新名字',
          email: 'new@example.com',
        });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.flatmate.name).toBe('新名字');
      expect(res.body.data.flatmate.email).toBe('new@example.com');
    });
  });

  describe('GET /api/v1/flatmates/balance', () => {
    it('should return flatmate balance', async () => {
      const flatmates = await createTestFlatmates();
      
      const res = await request(app)
        .get('/api/v1/flatmates/balance')
        .set('x-user-id', flatmates[0].id);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.balance).toBeDefined();
    });
  });
});
