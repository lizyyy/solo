const request = require('supertest');
const path = require('path');
const store = require('../src/store');

describe('Message Queue Analyzer API', () => {
  let app;
  
  beforeAll(() => {
    app = require('../src/index');
  });
  
  beforeEach(() => {
    store.clear();
  });

  describe('Health Check', () => {
    it('should return OK status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });
  });

  describe('API Root', () => {
    it('should return API information', async () => {
      const response = await request(app).get('/api');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.version).toBe('1.0.0');
    });
  });

  describe('Data Import', () => {
    it('should import producers from yaml file', async () => {
      const filePath = path.join(__dirname, '../data/producers.yaml');
      const response = await request(app)
        .post('/api/import/producers')
        .send({ filePath })
        .set('Content-Type', 'application/json');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBeGreaterThan(0);
    });

    it('should import topics from yaml file', async () => {
      const filePath = path.join(__dirname, '../data/topics.yaml');
      const response = await request(app)
        .post('/api/import/topics')
        .send({ filePath })
        .set('Content-Type', 'application/json');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBeGreaterThan(0);
    });

    it('should import messages from jsonl file', async () => {
      const filePath = path.join(__dirname, '../data/messages.jsonl');
      const response = await request(app)
        .post('/api/import/messages')
        .send({ filePath })
        .set('Content-Type', 'application/json');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBeGreaterThan(0);
    });

    it('should import delivery events from jsonl file', async () => {
      const filePath = path.join(__dirname, '../data/delivery-events.jsonl');
      const response = await request(app)
        .post('/api/import/delivery-events')
        .send({ filePath })
        .set('Content-Type', 'application/json');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBeGreaterThan(0);
    });

    it('should import all data from directory', async () => {
      const directory = path.join(__dirname, '../data');
      const response = await request(app)
        .post('/api/import/all')
        .send({ directory })
        .set('Content-Type', 'application/json');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Data Query', () => {
    beforeEach(async () => {
      const directory = path.join(__dirname, '../data');
      await request(app)
        .post('/api/import/all')
        .send({ directory })
        .set('Content-Type', 'application/json');
    });

    it('should get all producers', async () => {
      const response = await request(app).get('/api/data/producers');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });

    it('should get all topics', async () => {
      const response = await request(app).get('/api/data/topics');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });

    it('should get all messages', async () => {
      const response = await request(app).get('/api/data/messages');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });

    it('should get messages by topic', async () => {
      const response = await request(app).get('/api/data/messages?topic=order-events');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should get all delivery events', async () => {
      const response = await request(app).get('/api/data/delivery-events');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });

    it('should get data stats', async () => {
      const response = await request(app).get('/api/data/stats');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('producers');
      expect(response.body.data).toHaveProperty('topics');
      expect(response.body.data).toHaveProperty('messages');
      expect(response.body.data).toHaveProperty('deliveryEvents');
    });
  });

  describe('Message Analysis', () => {
    beforeEach(async () => {
      const directory = path.join(__dirname, '../data');
      await request(app)
        .post('/api/import/all')
        .send({ directory })
        .set('Content-Type', 'application/json');
    });

    it('should analyze a single message', async () => {
      const response = await request(app).get('/api/analysis/messages/msg-001');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.messageId).toBe('msg-001');
    });

    it('should return 404 for non-existent message', async () => {
      const response = await request(app).get('/api/analysis/messages/non-existent');
      expect(response.status).toBe(404);
    });

    it('should get message delivery chain', async () => {
      const response = await request(app).get('/api/analysis/messages/msg-001/delivery-chain');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('message');
      expect(response.body.data).toHaveProperty('deliveryChain');
      expect(response.body.data).toHaveProperty('analysis');
    });

    it('should detect ACK lost for msg-003', async () => {
      const response = await request(app).get('/api/analysis/messages/msg-003');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.ackLost).toBe(true);
    });

    it('should detect duplicate deliveries for msg-004', async () => {
      const response = await request(app).get('/api/analysis/messages/msg-004');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.duplicateDeliveries).toBeGreaterThan(0);
    });

    it('should detect max retry reached for msg-005', async () => {
      const response = await request(app).get('/api/analysis/messages/msg-005');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.maxRetryReached).toBe(true);
    });

    it('should detect dead letter for msg-008', async () => {
      const response = await request(app).get('/api/analysis/messages/msg-008');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.deadLetterReason).toBeTruthy();
    });

    it('should detect idempotency risk for msg-009', async () => {
      const response = await request(app).get('/api/analysis/messages/msg-009');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.idempotencyRisk).toBe(true);
    });

    it('should replay message', async () => {
      const response = await request(app)
        .post('/api/analysis/messages/msg-003/replay')
        .send({ consumerGroup: 'order-processor-group' })
        .set('Content-Type', 'application/json');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should batch analyze messages', async () => {
      const response = await request(app)
        .post('/api/analysis/batch')
        .send({ messageIds: ['msg-001', 'msg-002', 'msg-003'] })
        .set('Content-Type', 'application/json');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(3);
    });
  });

  describe('Task Management', () => {
    beforeEach(async () => {
      const directory = path.join(__dirname, '../data');
      await request(app)
        .post('/api/import/all')
        .send({ directory })
        .set('Content-Type', 'application/json');
    });

    it('should create a task', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({
          name: 'Test Task',
          description: 'Test description',
          messageIds: ['msg-001', 'msg-002'],
          consumerGroup: 'test-group'
        })
        .set('Content-Type', 'application/json');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Task');
    });

    it('should get all tasks', async () => {
      await request(app)
        .post('/api/tasks')
        .send({
          name: 'Test Task 1',
          messageIds: ['msg-001'],
          consumerGroup: 'test-group'
        })
        .set('Content-Type', 'application/json');

      const response = await request(app).get('/api/tasks');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });

    it('should execute a task', async () => {
      const createResponse = await request(app)
        .post('/api/tasks')
        .send({
          name: 'Test Task',
          messageIds: ['msg-001', 'msg-002', 'msg-003'],
          consumerGroup: 'test-group'
        })
        .set('Content-Type', 'application/json');
      
      const taskId = createResponse.body.data.id;
      
      const executeResponse = await request(app)
        .post(`/api/tasks/${taskId}/execute`);
      
      expect(executeResponse.status).toBe(200);
      expect(executeResponse.body.success).toBe(true);
    });
  });

  describe('Report Generation', () => {
    let taskId;
    
    beforeEach(async () => {
      const directory = path.join(__dirname, '../data');
      await request(app)
        .post('/api/import/all')
        .send({ directory })
        .set('Content-Type', 'application/json');
      
      const createResponse = await request(app)
        .post('/api/tasks')
        .send({
          name: 'Report Test Task',
          messageIds: ['msg-001', 'msg-003', 'msg-004', 'msg-005', 'msg-008', 'msg-009'],
          consumerGroup: 'test-group'
        })
        .set('Content-Type', 'application/json');
      
      taskId = createResponse.body.data.id;
      
      await request(app).post(`/api/tasks/${taskId}/execute`);
    });

    it('should generate Markdown report', async () => {
      const response = await request(app)
        .post(`/api/tasks/${taskId}/report?format=markdown`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.format).toBe('markdown');
    });

    it('should generate JSON report', async () => {
      const response = await request(app)
        .post(`/api/tasks/${taskId}/report?format=json`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.format).toBe('json');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoint', async () => {
      const response = await request(app).get('/api/non-existent');
      expect(response.status).toBe(404);
    });

    it('should return 400 for missing filePath in import', async () => {
      const response = await request(app)
        .post('/api/import/producers')
        .send({})
        .set('Content-Type', 'application/json');
      
      expect(response.status).toBe(400);
    });

    it('should return 400 for missing messageIds in batch analyze', async () => {
      const response = await request(app)
        .post('/api/analysis/batch')
        .send({})
        .set('Content-Type', 'application/json');
      
      expect(response.status).toBe(400);
    });
  });
});
