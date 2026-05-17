import request from 'supertest';
import app from '../server';
import { RecycleStatus } from '../types';

describe('Gray Config Recycle API', () => {
  describe('POST /api/recycle', () => {
    it('should create a new recycle record', async () => {
      const response = await request(app)
        .post('/api/recycle')
        .send({
          configKey: 'api.test.v1',
          grayScope: { type: 'percentage', value: 50 },
          owner: 'tester',
          recycleDate: '2025-12-31T00:00:00.000Z'
        });

      expect(response.status).toBe(201);
      expect(response.body.configKey).toBe('api.test.v1');
      expect(response.body.status).toBe(RecycleStatus.PENDING);
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/recycle')
        .send({
          configKey: 'api.test.v2'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/recycle/:id', () => {
    it('should get a record by id', async () => {
      const createResponse = await request(app)
        .post('/api/recycle')
        .send({
          configKey: 'api.test.get',
          grayScope: { type: 'percentage', value: 50 },
          owner: 'tester',
          recycleDate: '2025-12-31T00:00:00.000Z'
        });

      const id = createResponse.body.id;

      const getResponse = await request(app).get(`/api/recycle/${id}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.configKey).toBe('api.test.get');
    });

    it('should return 404 for non-existent id', async () => {
      const response = await request(app).get('/api/recycle/non-existent-id');
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/recycle', () => {
    it('should query records with pagination', async () => {
      const response = await request(app)
        .get('/api/recycle')
        .query({ page: 1, pageSize: 10 });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.total).toBeDefined();
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/recycle')
        .query({ status: RecycleStatus.PENDING });

      expect(response.status).toBe(200);
      for (const record of response.body.data) {
        expect(record.status).toBe(RecycleStatus.PENDING);
      }
    });
  });

  describe('PATCH /api/recycle/:id/status', () => {
    it('should transition status successfully', async () => {
      const createResponse = await request(app)
        .post('/api/recycle')
        .send({
          configKey: 'api.test.status',
          grayScope: { type: 'percentage', value: 50 },
          owner: 'tester',
          recycleDate: '2025-12-31T00:00:00.000Z'
        });

      const id = createResponse.body.id;

      const statusResponse = await request(app)
        .patch(`/api/recycle/${id}/status`)
        .send({
          status: RecycleStatus.IN_PROGRESS,
          operator: 'tester'
        });

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.status).toBe(RecycleStatus.IN_PROGRESS);
    });

    it('should return 400 for invalid status transition', async () => {
      const createResponse = await request(app)
        .post('/api/recycle')
        .send({
          configKey: 'api.test.invalid-status',
          grayScope: { type: 'percentage', value: 50 },
          owner: 'tester',
          recycleDate: '2025-12-31T00:00:00.000Z'
        });

      const id = createResponse.body.id;

      const statusResponse = await request(app)
        .patch(`/api/recycle/${id}/status`)
        .send({
          status: RecycleStatus.COMPLETED,
          operator: 'tester'
        });

      expect(statusResponse.status).toBe(400);
    });

    it('should not allow duplicate status completion', async () => {
      const createResponse = await request(app)
        .post('/api/recycle')
        .send({
          configKey: 'api.test.duplicate',
          grayScope: { type: 'percentage', value: 50 },
          owner: 'tester',
          recycleDate: '2025-12-31T00:00:00.000Z',
          hitTenants: ['tenant1']
        });

      const id = createResponse.body.id;

      await request(app)
        .patch(`/api/recycle/${id}/status`)
        .send({ status: RecycleStatus.IN_PROGRESS, operator: 'tester' });

      await request(app)
        .patch(`/api/recycle/${id}/status`)
        .send({ status: RecycleStatus.COMPLETED, operator: 'tester' });

      const duplicateResponse = await request(app)
        .patch(`/api/recycle/${id}/status`)
        .send({ status: RecycleStatus.COMPLETED, operator: 'tester' });

      expect(duplicateResponse.status).toBe(400);
    });
  });

  describe('GET /api/recycle/export', () => {
    it('should export records as CSV', async () => {
      const response = await request(app).get('/api/recycle/export');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.text).toContain('ID');
      expect(response.text).toContain('配置键');
    });

    it('should export statistics as CSV', async () => {
      const response = await request(app)
        .get('/api/recycle/export')
        .query({ type: 'statistics' });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.text).toContain('指标');
      expect(response.text).toContain('数值');
    });
  });

  describe('PATCH /api/recycle/:id/manual-correction', () => {
    it('should apply manual correction', async () => {
      const createResponse = await request(app)
        .post('/api/recycle')
        .send({
          configKey: 'api.test.correction',
          grayScope: { type: 'percentage', value: 50 },
          owner: 'tester',
          recycleDate: '2025-12-31T00:00:00.000Z'
        });

      const id = createResponse.body.id;

      const correctionResponse = await request(app)
        .patch(`/api/recycle/${id}/manual-correction`)
        .send({
          configKey: 'api.test.correction-updated',
          operator: 'admin',
          reason: 'Fixed configuration key'
        });

      expect(correctionResponse.status).toBe(200);
      expect(correctionResponse.body.configKey).toBe('api.test.correction-updated');
      expect(correctionResponse.body.exceptions.length).toBeGreaterThan(0);
    });
  });
});
