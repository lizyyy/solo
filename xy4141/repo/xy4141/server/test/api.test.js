const request = require('supertest');
const path = require('path');
const fs = require('fs');

const testDbPath = path.join(__dirname, '../data/test-anomalies.db');

let app;
let db;

beforeAll(() => {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  
  process.env.TEST_DB = testDbPath;
  
  delete require.cache[require.resolve('../src/database')];
  delete require.cache[require.resolve('../src/models')];
  delete require.cache[require.resolve('../src/app')];
  
  app = require('../src/app');
});

afterAll(() => {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

describe('GET /api/health', () => {
  it('should return health status ok', async () => {
    const response = await request(app).get('/api/health');
    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeDefined();
  });
});

describe('Exams API', () => {
  describe('POST /api/exams', () => {
    it('should create a new exam', async () => {
      const examData = {
        exam_code: 'TEST001',
        exam_name: '测试考试',
        start_time: '2024-01-01T09:00:00Z',
        end_time: '2024-01-01T11:00:00Z'
      };

      const response = await request(app)
        .post('/api/exams')
        .send(examData)
        .set('Content-Type', 'application/json');

      expect(response.statusCode).toBe(201);
      expect(response.body.exam_code).toBe('TEST001');
      expect(response.body.exam_name).toBe('测试考试');
    });

    it('should return 400 when required fields are missing', async () => {
      const response = await request(app)
        .post('/api/exams')
        .send({ exam_name: '测试考试' })
        .set('Content-Type', 'application/json');

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/exams', () => {
    it('should return list of exams', async () => {
      await request(app)
        .post('/api/exams')
        .send({ exam_code: 'TEST002', exam_name: '测试考试2' })
        .set('Content-Type', 'application/json');

      const response = await request(app).get('/api/exams');
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });
});

describe('Anomalies API', () => {
  describe('POST /api/anomalies', () => {
    it('should create a new anomaly record', async () => {
      const anomalyData = {
        exam_code: 'TEST001',
        student_id: 'S001',
        student_name: '张三',
        anomaly_type: 'suspicious_behavior',
        description: '考生频繁看向桌面'
      };

      const response = await request(app)
        .post('/api/anomalies')
        .field('exam_code', anomalyData.exam_code)
        .field('student_id', anomalyData.student_id)
        .field('student_name', anomalyData.student_name)
        .field('anomaly_type', anomalyData.anomaly_type)
        .field('description', anomalyData.description);

      expect(response.statusCode).toBe(201);
      expect(response.body.student_id).toBe('S001');
      expect(response.body.status).toBe('pending');
    });

    it('should return 400 when required fields are missing', async () => {
      const response = await request(app)
        .post('/api/anomalies')
        .field('student_id', 'S001')
        .field('anomaly_type', 'suspicious_behavior');

      expect(response.statusCode).toBe(400);
    });

    it('should deduplicate same student same type within 5 minutes', async () => {
      const firstResponse = await request(app)
        .post('/api/anomalies')
        .field('exam_code', 'TEST001')
        .field('student_id', 'S002')
        .field('student_name', '李四')
        .field('anomaly_type', 'look_away')
        .field('description', '第一次看向窗外');

      expect(firstResponse.statusCode).toBe(201);
      const firstId = firstResponse.body.id;

      const secondResponse = await request(app)
        .post('/api/anomalies')
        .field('exam_code', 'TEST001')
        .field('student_id', 'S002')
        .field('anomaly_type', 'look_away')
        .field('description', '第二次看向窗外');

      expect(secondResponse.statusCode).toBe(201);
      expect(secondResponse.body.id).toBe(firstId);
      expect(secondResponse.body.description).toContain('第一次看向窗外');
      expect(secondResponse.body.description).toContain('第二次看向窗外');
    });
  });

  describe('GET /api/anomalies', () => {
    it('should return list of anomalies', async () => {
      const response = await request(app).get('/api/anomalies');
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter by exam_code', async () => {
      const response = await request(app).get('/api/anomalies?exam_code=TEST001');
      expect(response.statusCode).toBe(200);
      expect(response.body.every(a => a.exam_code === 'TEST001')).toBe(true);
    });

    it('should filter by status', async () => {
      const response = await request(app).get('/api/anomalies?status=pending');
      expect(response.statusCode).toBe(200);
      expect(response.body.every(a => a.status === 'pending')).toBe(true);
    });
  });

  describe('GET /api/anomalies/:id', () => {
    it('should return single anomaly by id', async () => {
      const createResponse = await request(app)
        .post('/api/anomalies')
        .field('exam_code', 'TEST001')
        .field('student_id', 'S003')
        .field('anomaly_type', 'phone_usage')
        .field('description', '使用手机');

      const id = createResponse.body.id;
      
      const response = await request(app).get(`/api/anomalies/${id}`);
      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(id);
      expect(response.body.student_id).toBe('S003');
    });

    it('should return 404 for non-existent id', async () => {
      const response = await request(app).get('/api/anomalies/999999');
      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/anomalies/:id', () => {
    it('should update anomaly status', async () => {
      const createResponse = await request(app)
        .post('/api/anomalies')
        .field('exam_code', 'TEST001')
        .field('student_id', 'S004')
        .field('anomaly_type', 'other')
        .field('description', '其他异常');

      const id = createResponse.body.id;

      const updateResponse = await request(app)
        .put(`/api/anomalies/${id}`)
        .send({ status: 'reviewed', reviewed_by: '监考老师A' })
        .set('Content-Type', 'application/json');

      expect(updateResponse.statusCode).toBe(200);
      expect(updateResponse.body.status).toBe('reviewed');
      expect(updateResponse.body.reviewed_by).toBe('监考老师A');
    });
  });

  describe('DELETE /api/anomalies/:id', () => {
    it('should delete anomaly', async () => {
      const createResponse = await request(app)
        .post('/api/anomalies')
        .field('exam_code', 'TEST001')
        .field('student_id', 'S005')
        .field('anomaly_type', 'no_face')
        .field('description', '无人出镜');

      const id = createResponse.body.id;

      const deleteResponse = await request(app).delete(`/api/anomalies/${id}`);
      expect(deleteResponse.statusCode).toBe(204);

      const getResponse = await request(app).get(`/api/anomalies/${id}`);
      expect(getResponse.statusCode).toBe(404);
    });
  });
});

describe('Stats API', () => {
  describe('GET /api/stats', () => {
    it('should return statistics', async () => {
      const response = await request(app).get('/api/stats');
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});

describe('Export API', () => {
  describe('GET /api/export/markdown', () => {
    it('should export markdown', async () => {
      const response = await request(app).get('/api/export/markdown');
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('markdown');
    });
  });

  describe('GET /api/export/csv', () => {
    it('should export csv', async () => {
      const response = await request(app).get('/api/export/csv');
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('csv');
    });
  });
});
