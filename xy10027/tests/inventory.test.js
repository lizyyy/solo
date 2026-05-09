const request = require('supertest');
const app = require('../server/index');
const db = require('../server/config/database');
const { redis } = require('../server/config/redis');
const jwt = require('jsonwebtoken');

jest.setTimeout(30000);

describe('Warehouse Inventory System Tests', () => {
  let token;
  let testTaskId;
  let testItemId;

  beforeAll(async () => {
    const testUser = {
      userId: '00000000-0000-0000-0000-000000000001',
      username: 'admin',
      role: 'admin'
    };
    
    token = jwt.sign(testUser, process.env.JWT_SECRET || 'test-secret', {
      expiresIn: '1h'
    });
  });

  afterAll(async () => {
    await db.pool.end();
    await redis.quit();
  });

  describe('Authentication Tests', () => {
    it('should reject requests without token', async () => {
      const response = await request(app)
        .get('/api/inventory/tasks');
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it('should accept requests with valid token', async () => {
      const response = await request(app)
        .get('/api/inventory/tasks')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.tasks).toBeDefined();
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/inventory/tasks')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
    });
  });

  describe('Inventory Item Tests', () => {
    it('should create a new inventory item', async () => {
      const response = await request(app)
        .post('/api/inventory/items')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Request-ID', 'test-create-item-' + Date.now())
        .send({
          sku: 'TEST-' + Date.now(),
          name: 'Test Item',
          description: 'Test Description',
          category: 'Test',
          unit: '个'
        });
      
      expect(response.status).toBe(201);
      expect(response.body.sku).toBeDefined();
      testItemId = response.body.id;
    });

    it('should prevent duplicate requests', async () => {
      const requestId = 'test-duplicate-' + Date.now();
      const itemData = {
        sku: 'DUP-' + Date.now(),
        name: 'Duplicate Test',
        description: 'Test',
        category: 'Test',
        unit: '个'
      };

      const response1 = await request(app)
        .post('/api/inventory/items')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Request-ID', requestId)
        .send(itemData);
      
      expect(response1.status).toBe(201);

      const response2 = await request(app)
        .post('/api/inventory/items')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Request-ID', requestId)
        .send(itemData);
      
      expect(response2.status).toBe(200);
      expect(response2.isDuplicate).toBe(true);
    });
  });

  describe('Inventory Task Tests', () => {
    it('should create a new inventory task', async () => {
      const response = await request(app)
        .post('/api/inventory/tasks')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Request-ID', 'test-create-task-' + Date.now())
        .send({
          warehouse_id: '10000000-0000-0000-0000-000000000001',
          name: 'Test Task ' + Date.now(),
          description: 'Test Description',
          priority: 'normal',
          scheduled_date: new Date().toISOString().split('T')[0]
        });
      
      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      testTaskId = response.body.id;
    });

    it('should get inventory tasks', async () => {
      const response = await request(app)
        .get('/api/inventory/tasks')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.tasks)).toBe(true);
    });

    it('should get task details', async () => {
      const response = await request(app)
        .get(`/api/inventory/tasks/30000000-0000-0000-0000-000000000001`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.id).toBe('30000000-0000-0000-0000-000000000001');
      expect(response.body.items).toBeDefined();
    });
  });

  describe('Concurrency Tests', () => {
    it('should handle optimistic locking conflicts', async () => {
      const updateData = {
        name: 'Updated Test Item',
        version: 1
      };

      const response1 = await request(app)
        .put(`/api/inventory/items/${testItemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);
      
      expect(response1.status).toBe(200);

      const response2 = await request(app)
        .put(`/api/inventory/items/${testItemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);
      
      expect(response2.status).toBe(409);
    });
  });

  describe('Audit Trail Tests', () => {
    it('should create audit logs for operations', async () => {
      const response = await request(app)
        .get(`/api/inventory/audit/inventory_items/${testItemId}`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.history)).toBe(true);
      expect(response.body.history.length).toBeGreaterThan(0);
    });

    it('should show before and after data in audit logs', async () => {
      const response = await request(app)
        .get(`/api/inventory/audit/inventory_items/${testItemId}`)
        .set('Authorization', `Bearer ${token}`);
      
      const updateLog = response.body.history.find(log => 
        log.operation_type === 'UPDATE'
      );
      
      if (updateLog) {
        expect(updateLog.before_data).toBeDefined();
        expect(updateLog.after_data).toBeDefined();
      }
    });
  });

  describe('Report Generation Tests', () => {
    it('should generate Excel report', async () => {
      const response = await request(app)
        .get('/api/inventory/report/30000000-0000-0000-0000-000000000001?format=excel')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('spreadsheet');
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should generate Markdown report', async () => {
      const response = await request(app)
        .get('/api/inventory/report/30000000-0000-0000-0000-000000000001?format=markdown')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('markdown');
      expect(response.text).toContain('# 仓库盘点报告');
    });

    it('should generate PDF report', async () => {
      const response = await request(app)
        .get('/api/inventory/report/30000000-0000-0000-0000-000000000001?format=pdf')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('pdf');
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('Offline Sync Tests', () => {
    it('should sync offline operations', async () => {
      const operations = [{
        type: 'update_count',
        request_id: 'sync-test-' + Date.now(),
        data: {
          task_item_id: '00000000-0000-0000-0000-000000000001',
          actual_quantity: 50,
          notes: 'Test sync operation'
        }
      }];

      const response = await request(app)
        .post('/api/inventory/sync')
        .set('Authorization', `Bearer ${token}`)
        .send({ operations });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.results)).toBe(true);
    });

    it('should handle duplicate sync requests', async () => {
      const requestId = 'sync-duplicate-test-' + Date.now();
      const operations = [{
        type: 'update_count',
        request_id: requestId,
        data: {
          task_item_id: '00000000-0000-0000-0000-000000000001',
          actual_quantity: 60,
          notes: 'Test duplicate sync'
        }
      }];

      const response1 = await request(app)
        .post('/api/inventory/sync')
        .set('Authorization', `Bearer ${token}`)
        .send({ operations });
      
      expect(response1.status).toBe(200);

      const response2 = await request(app)
        .post('/api/inventory/sync')
        .set('Authorization', `Bearer ${token}`)
        .send({ operations });
      
      expect(response2.status).toBe(200);
      
      const firstResult = response1.body.results[0];
      const secondResult = response2.body.results[0];
      
      expect(secondResult.status).toBe('duplicate');
    });
  });

  describe('Health Check Tests', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });
  });
});
