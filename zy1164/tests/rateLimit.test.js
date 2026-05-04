const request = require('supertest');
const app = require('../src/index');
const db = require('../src/database');

describe('Rate Limit Service Tests', () => {
  let testAppKeyId;
  let testRouteId;
  let isInitialized = false;

  const TEST_APP_KEY = 'ak_unit_test_001';
  const TEST_PATH = '/api/unit-test';
  const TEST_METHOD = 'GET';

  beforeAll(async () => {
    await db.init();
    
    const existingAppKey = db.get('SELECT id FROM app_keys WHERE app_key = ?', [TEST_APP_KEY]);
    if (existingAppKey) {
      testAppKeyId = existingAppKey.id;
    } else {
      const appKeyResult = db.run(
        `INSERT INTO app_keys (app_key, name, description, is_active)
         VALUES (?, ?, ?, ?)`,
        [TEST_APP_KEY, '单元测试应用', '用于单元测试的应用', 1]
      );
      testAppKeyId = appKeyResult?.lastInsertRowid;
    }

    const existingRoute = db.get('SELECT id FROM routes WHERE path = ? AND method = ?', [TEST_PATH, TEST_METHOD]);
    if (existingRoute) {
      testRouteId = existingRoute.id;
    } else {
      const routeResult = db.run(
        `INSERT INTO routes (path, method, description, is_active)
         VALUES (?, ?, ?, ?)`,
        [TEST_PATH, TEST_METHOD, '单元测试路由', 1]
      );
      testRouteId = routeResult?.lastInsertRowid;
    }
    
    isInitialized = true;
  });

  afterAll(() => {
    if (testAppKeyId) {
      db.run('DELETE FROM request_logs WHERE app_key_id = ?', [testAppKeyId]);
      db.run('DELETE FROM rate_limit_configs WHERE app_key_id = ?', [testAppKeyId]);
    }
    if (testRouteId) {
      db.run('DELETE FROM routes WHERE id = ?', [testRouteId]);
    }
    if (testAppKeyId) {
      db.run('DELETE FROM app_keys WHERE id = ?', [testAppKeyId]);
    }
    db.close();
  });

  beforeEach(() => {
    if (testAppKeyId) {
      db.run('DELETE FROM request_logs WHERE app_key_id = ?', [testAppKeyId]);
      db.run('DELETE FROM rate_limit_configs WHERE app_key_id = ?', [testAppKeyId]);
    }
  });

  describe('Fixed Window Algorithm', () => {
    beforeEach(() => {
      if (testAppKeyId && testRouteId) {
        db.run(
          `INSERT INTO rate_limit_configs 
           (app_key_id, route_id, algorithm, request_limit, window_seconds, is_active)
           VALUES (?, ?, 'fixed-window', 5, 60, 1)`,
          [testAppKeyId, testRouteId]
        );
      }
    });

    test('应该允许在配额内的请求', async () => {
      expect(isInitialized).toBe(true);
      expect(testAppKeyId).toBeDefined();
      
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/rate-limit/check')
          .send({
            appKey: TEST_APP_KEY,
            path: TEST_PATH,
            method: TEST_METHOD
          });
        
        expect(response.status).toBe(200);
        expect(response.body.allowed).toBe(true);
        expect(response.body.currentCount).toBe(i);
      }
    });

    test('应该拒绝超出配额的请求', async () => {
      expect(isInitialized).toBe(true);
      
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/rate-limit/check')
          .send({
            appKey: TEST_APP_KEY,
            path: TEST_PATH,
            method: TEST_METHOD
          });
      }

      const response = await request(app)
        .post('/api/rate-limit/check')
        .send({
          appKey: TEST_APP_KEY,
          path: TEST_PATH,
          method: TEST_METHOD
        });
      
      expect(response.status).toBe(200);
      expect(response.body.allowed).toBe(false);
      expect(response.body.action).toBe('rejected');
      expect(response.body.algorithm).toBe('fixed-window');
    });

    test('请求日志应该正确记录', async () => {
      expect(isInitialized).toBe(true);
      
      await request(app)
        .post('/api/rate-limit/check')
        .send({
          appKey: TEST_APP_KEY,
          path: TEST_PATH,
          method: TEST_METHOD
        });

      const logs = db.all(
        `SELECT * FROM request_logs WHERE app_key_id = ? AND route_id = ?`,
        [testAppKeyId, testRouteId]
      );

      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('allowed');
      expect(logs[0].algorithm).toBe('fixed-window');
      expect(logs[0].request_limit).toBe(5);
    });
  });

  describe('Sliding Window Algorithm', () => {
    beforeEach(() => {
      if (testAppKeyId && testRouteId) {
        db.run(
          `INSERT INTO rate_limit_configs 
           (app_key_id, route_id, algorithm, request_limit, window_seconds, is_active)
           VALUES (?, ?, 'sliding-window', 5, 60, 1)`,
          [testAppKeyId, testRouteId]
        );
      }
    });

    test('应该允许在滑动窗口内的请求', async () => {
      expect(isInitialized).toBe(true);
      
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/rate-limit/check')
          .send({
            appKey: TEST_APP_KEY,
            path: TEST_PATH,
            method: TEST_METHOD
          });
        
        expect(response.status).toBe(200);
        expect(response.body.allowed).toBe(true);
        expect(response.body.algorithm).toBe('sliding-window');
      }
    });

    test('应该拒绝超出滑动窗口配额的请求', async () => {
      expect(isInitialized).toBe(true);
      
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/rate-limit/check')
          .send({
            appKey: TEST_APP_KEY,
            path: TEST_PATH,
            method: TEST_METHOD
          });
      }

      const response = await request(app)
        .post('/api/rate-limit/check')
        .send({
          appKey: TEST_APP_KEY,
          path: TEST_PATH,
          method: TEST_METHOD
        });
      
      expect(response.status).toBe(200);
      expect(response.body.allowed).toBe(false);
      expect(response.body.action).toBe('rejected');
    });
  });

  describe('Concurrent Simulation API', () => {
    beforeEach(() => {
      if (testAppKeyId && testRouteId) {
        db.run(
          `INSERT INTO rate_limit_configs 
           (app_key_id, route_id, algorithm, request_limit, window_seconds, is_active)
           VALUES (?, ?, 'fixed-window', 10, 60, 1)`,
          [testAppKeyId, testRouteId]
        );
      }
    });

    test('并发模拟应该正确限流', async () => {
      expect(isInitialized).toBe(true);
      
      const response = await request(app)
        .post('/api/rate-limit/simulate/concurrent')
        .send({
          appKey: TEST_APP_KEY,
          path: TEST_PATH,
          method: TEST_METHOD,
          requestCount: 20
        });
      
      expect(response.status).toBe(200);
      expect(response.body.totalRequests).toBe(20);
      expect(response.body.allowedCount).toBe(10);
      expect(response.body.rejectedCount).toBe(10);
      expect(response.body.allowedRate).toBe(0.5);
    });
  });

  describe('Invalid App Key', () => {
    test('应该拒绝无效的 app key', async () => {
      const response = await request(app)
        .post('/api/rate-limit/check')
        .send({
          appKey: 'invalid_key_that_does_not_exist',
          path: TEST_PATH,
          method: TEST_METHOD
        });
      
      expect(response.status).toBe(200);
      expect(response.body.allowed).toBe(false);
      expect(response.body.reason).toBe('invalid_app_key');
    });
  });

  describe('No Rate Limit Config', () => {
    test('未配置限流的路由应该允许所有请求', async () => {
      expect(isInitialized).toBe(true);
      
      const newRouteResult = db.run(
        `INSERT INTO routes (path, method, description, is_active)
         VALUES (?, ?, ?, ?)`,
        ['/api/no-limit', 'GET', '无配置路由', 1]
      );
      const newRouteId = newRouteResult?.lastInsertRowid;

      try {
        const response = await request(app)
          .post('/api/rate-limit/check')
          .send({
            appKey: TEST_APP_KEY,
            path: '/api/no-limit',
            method: 'GET'
          });
        
        expect(response.status).toBe(200);
        expect(response.body.allowed).toBe(true);
        expect(response.body.reason).toBe('no_limit_config');
      } finally {
        if (newRouteId) {
          db.run('DELETE FROM routes WHERE id = ?', [newRouteId]);
        }
      }
    });
  });

  describe('Statistics API', () => {
    beforeEach(() => {
      if (testAppKeyId && testRouteId) {
        db.run(
          `INSERT INTO rate_limit_configs 
           (app_key_id, route_id, algorithm, request_limit, window_seconds, is_active)
           VALUES (?, ?, 'fixed-window', 3, 60, 1)`,
          [testAppKeyId, testRouteId]
        );
      }
    });

    test('统计 API 应该返回正确数据', async () => {
      expect(isInitialized).toBe(true);
      
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/rate-limit/check')
          .send({
            appKey: TEST_APP_KEY,
            path: TEST_PATH,
            method: TEST_METHOD
          });
      }

      const response = await request(app)
        .get('/api/rate-limit/stats');
      
      expect(response.status).toBe(200);
      expect(response.body.summary).toBeDefined();
      expect(response.body.summary.totalRequests).toBeGreaterThanOrEqual(5);
      expect(response.body.summary.allowedRequests).toBe(3);
      expect(response.body.summary.rejectedRequests).toBe(2);
    });
  });

  describe('Request Validation', () => {
    test('缺少必需参数应该返回 400', async () => {
      const response = await request(app)
        .post('/api/rate-limit/check')
        .send({
          path: TEST_PATH
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    test('无效的 HTTP 方法应该返回 400', async () => {
      const response = await request(app)
        .post('/api/rate-limit/check')
        .send({
          appKey: TEST_APP_KEY,
          path: TEST_PATH,
          method: 'INVALID_METHOD'
        });
      
      expect(response.status).toBe(400);
    });
  });
});
