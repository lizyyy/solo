process.env.NODE_ENV = 'test';

const request = require('supertest');
const { v4: uuidv4 } = require('uuid');
const app = require('../src/app');
const Sample = require('../src/models/sample');
const Audit = require('../src/models/audit');
const { SampleStatus, StepType, ErrorCode } = require('../src/constants/status');

describe('Sample Flow API Tests', () => {
  beforeAll(async () => {
    await app.ready;
  });

  beforeEach(async () => {
    await Sample.destroy({ where: {}, force: true });
    await Audit.destroy({ where: {}, force: true });
  });

  describe('Sample Creation', () => {
    test('should create a sample successfully', async () => {
      const barcode = `TEST-${uuidv4()}`;
      const response = await request(app)
        .post('/api/samples')
        .send({ barcode, handler: '张三' });

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sample.barcode).toBe(barcode);
      expect(response.body.data.sample.status).toBe(SampleStatus.INIT);
    });

    test('should return idempotent response for duplicate barcode', async () => {
      const barcode = `TEST-DUP-${uuidv4()}`;
      
      await request(app)
        .post('/api/samples')
        .send({ barcode, handler: '张三' });

      const response = await request(app)
        .post('/api/samples')
        .send({ barcode, handler: '张三' });

      expect(response.statusCode).toBe(409);
      expect(response.body.code).toBe(ErrorCode.BARCODE_IDEMPOTENT);
      expect(response.body.data.isIdempotent).toBe(true);
    });
  });

  describe('State Transitions', () => {
    let barcode;

    beforeEach(async () => {
      barcode = `FLOW-${uuidv4()}`;
      await request(app)
        .post('/api/samples')
        .send({ barcode, handler: '测试员' });
    });

    test('should complete full flow: INIT -> COLLECTED -> CENTRIFUGED -> TESTED -> REVIEWED', async () => {
      let response;
      
      response = await request(app)
        .post('/api/samples/collect')
        .set('X-Request-ID', uuidv4())
        .send({ barcode, handler: '采集员' });
      expect(response.statusCode).toBe(200);
      expect(response.body.data.sample.status).toBe(SampleStatus.COLLECTED);

      response = await request(app)
        .post('/api/samples/centrifuge')
        .set('X-Request-ID', uuidv4())
        .send({ barcode, handler: '离心员' });
      expect(response.statusCode).toBe(200);
      expect(response.body.data.sample.status).toBe(SampleStatus.CENTRIFUGED);

      response = await request(app)
        .post('/api/samples/test')
        .set('X-Request-ID', uuidv4())
        .send({ barcode, handler: '上机员' });
      expect(response.statusCode).toBe(200);
      expect(response.body.data.sample.status).toBe(SampleStatus.TESTED);

      response = await request(app)
        .post('/api/samples/review')
        .set('X-Request-ID', uuidv4())
        .send({ barcode, handler: '复核员' });
      expect(response.statusCode).toBe(200);
      expect(response.body.data.sample.status).toBe(SampleStatus.REVIEWED);
    });

    test('should reject invalid state transition', async () => {
      const response = await request(app)
        .post('/api/samples/centrifuge')
        .set('X-Request-ID', uuidv4())
        .send({ barcode, handler: '离心员' });

      expect(response.statusCode).toBe(409);
      expect(response.body.code).toBe(ErrorCode.STATE_TRANSITION_ERROR);
    });

    test('should handle missing sample', async () => {
      const response = await request(app)
        .post('/api/samples/collect')
        .set('X-Request-ID', uuidv4())
        .send({ barcode: 'NONEXISTENT', handler: '测试员' });

      expect(response.statusCode).toBe(404);
      expect(response.body.code).toBe(ErrorCode.SAMPLE_NOT_FOUND);
    });
  });

  describe('Idempotency', () => {
    test('should handle duplicate requests idempotently', async () => {
      const barcode = `IDEMPOTENT-${uuidv4()}`;
      const requestId = uuidv4();

      await request(app)
        .post('/api/samples')
        .send({ barcode, handler: '测试员' });

      const firstResponse = await request(app)
        .post('/api/samples/collect')
        .set('X-Request-ID', requestId)
        .send({ barcode, handler: '采集员' });

      const secondResponse = await request(app)
        .post('/api/samples/collect')
        .set('X-Request-ID', requestId)
        .send({ barcode, handler: '采集员' });

      expect(firstResponse.statusCode).toBe(200);
      expect(firstResponse.body.data.isIdempotent).toBe(false);

      expect(secondResponse.statusCode).toBe(200);
      expect(secondResponse.body.data.isIdempotent).toBe(true);

      const auditCount = await Audit.count({ where: { barcode, stepType: StepType.COLLECT, action: 'NORMAL' } });
      expect(auditCount).toBe(1);
    });
  });

  describe('Exception Handling', () => {
    test('should report exception and prevent further steps', async () => {
      const barcode = `EXCEPT-${uuidv4()}`;
      
      await request(app)
        .post('/api/samples')
        .send({ barcode, handler: '测试员' });

      await request(app)
        .post('/api/samples/collect')
        .set('X-Request-ID', uuidv4())
        .send({ barcode, handler: '采集员' });

      const exceptionResponse = await request(app)
        .post('/api/samples/exception')
        .send({ 
          barcode, 
          reason: '样本溶血，需要重新采集', 
          handler: '质控员' 
        });

      expect(exceptionResponse.statusCode).toBe(200);
      expect(exceptionResponse.body.data.sample.status).toBe(SampleStatus.EXCEPTION);

      const centrifugeResponse = await request(app)
        .post('/api/samples/centrifuge')
        .set('X-Request-ID', uuidv4())
        .send({ barcode, handler: '离心员' });

      expect(centrifugeResponse.statusCode).toBe(409);
    });

    test('should resolve exception and resume flow', async () => {
      const barcode = `RESOLVE-${uuidv4()}`;
      
      await request(app)
        .post('/api/samples')
        .send({ barcode, handler: '测试员' });

      await request(app)
        .post('/api/samples/collect')
        .set('X-Request-ID', uuidv4())
        .send({ barcode, handler: '采集员' });

      await request(app)
        .post('/api/samples/exception')
        .send({ barcode, reason: '测试异常', handler: '质控员' });

      const resolveResponse = await request(app)
        .post('/api/samples/exception/resolve')
        .send({ 
          barcode, 
          targetStep: StepType.CENTRIFUGE, 
          handler: '质控员' 
        });

      expect(resolveResponse.statusCode).toBe(200);
      expect(resolveResponse.body.data.sample.status).toBe(SampleStatus.COLLECTED);

      const centrifugeResponse = await request(app)
        .post('/api/samples/centrifuge')
        .set('X-Request-ID', uuidv4())
        .send({ barcode, handler: '离心员' });

      expect(centrifugeResponse.statusCode).toBe(200);
    });
  });

  describe('Audit Trail', () => {
    test('should record audit logs for all operations', async () => {
      const barcode = `AUDIT-${uuidv4()}`;
      
      await request(app)
        .post('/api/samples')
        .send({ barcode, handler: '测试员' });

      await request(app)
        .post('/api/samples/collect')
        .set('X-Request-ID', uuidv4())
        .send({ barcode, handler: '采集员' });

      const auditResponse = await request(app)
        .get('/api/audits')
        .query({ barcode });

      expect(auditResponse.statusCode).toBe(200);
      expect(auditResponse.body.data.total).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Statistics', () => {
    test('should return statistics consistent with audit logs', async () => {
      const bc1 = `STAT-1-${uuidv4()}`;
      const bc2 = `STAT-2-${uuidv4()}`;

      await request(app).post('/api/samples').send({ barcode: bc1, handler: '测试员' });
      await request(app).post('/api/samples').send({ barcode: bc2, handler: '测试员' });

      await request(app)
        .post('/api/samples/collect')
        .set('X-Request-ID', uuidv4())
        .send({ barcode: bc1, handler: '采集员' });

      await request(app)
        .post('/api/samples/collect')
        .set('X-Request-ID', uuidv4())
        .send({ barcode: bc2, handler: '采集员' });

      const statsResponse = await request(app).get('/api/statistics');
      
      expect(statsResponse.statusCode).toBe(200);

      const statusDist = statsResponse.body.data.statusDistribution;
      const collectedCount = statusDist.find(s => s.status === SampleStatus.COLLECTED);
      
      expect(collectedCount).toBeDefined();
      expect(collectedCount.count).toBe(2);
    });
  });

  describe('Duration Calculation', () => {
    test('should calculate step durations', async () => {
      const barcode = `DURATION-${uuidv4()}`;
      
      await request(app)
        .post('/api/samples')
        .send({ barcode, handler: '测试员' });

      const collectResponse = await request(app)
        .post('/api/samples/collect')
        .set('X-Request-ID', uuidv4())
        .send({ barcode, handler: '采集员' });

      await new Promise(resolve => setTimeout(resolve, 10));

      const centrifugeResponse = await request(app)
        .post('/api/samples/centrifuge')
        .set('X-Request-ID', uuidv4())
        .send({ barcode, handler: '离心员' });

      expect(centrifugeResponse.body.data.durationMs).toBeDefined();
      expect(centrifugeResponse.body.data.durationMs).toBeGreaterThanOrEqual(0);

      const audit = await Audit.findOne({
        where: { barcode, stepType: StepType.CENTRIFUGE, action: 'NORMAL' }
      });

      expect(audit.durationMs).toBeDefined();
    });
  });
});
