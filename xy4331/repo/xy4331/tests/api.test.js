const request = require('supertest');
const path = require('path');
const fs = require('fs');

const TEST_DATA = {
  animals: [
    {
      animal_id: "TEST-M-001",
      species: "小鼠",
      strain: "C57BL/6",
      gender: "雄性",
      birth_date: "2024-01-15",
      arrival_date: "2024-02-01",
      status: "active"
    }
  ],
  cages: [
    {
      cage_id: "TEST-C-001",
      rack_id: "TEST-RA-01",
      position: "A1",
      max_capacity: 5,
      status: "available"
    }
  ],
  sensorAlerts: [
    {
      alert_id: "TEST-ALERT-001",
      cage_id: "TEST-C-001",
      sensor_type: "温度",
      threshold_value: 26.0,
      measured_value: 28.5,
      alert_time: "2024-12-18T08:30:00",
      severity: "high",
      status: "open"
    }
  ]
};

let app;
let server;

beforeAll(async () => {
  jest.setTimeout(10000);
  
  const dbPath = path.join(__dirname, '../data/test_database.db');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  
  process.env.DB_PATH = dbPath;
  process.env.PORT = '3001';
  
  app = require('../src/server');
  
  await new Promise(resolve => setTimeout(resolve, 2000));
});

afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 500));
});

describe('健康检查接口', () => {
  it('应该返回健康状态OK', async () => {
    const res = await request('http://localhost:3001').get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('应该返回API文档', async () => {
    const res = await request('http://localhost:3001').get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('笼位健康事件仲裁器');
  });
});

describe('数据导入接口', () => {
  it('应该成功导入笼位数据', async () => {
    const res = await request('http://localhost:3001')
      .post('/api/import/cages')
      .send({ cages: TEST_DATA.cages });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.imported).toBe(1);
  });

  it('应该成功导入动物数据', async () => {
    const res = await request('http://localhost:3001')
      .post('/api/import/animals')
      .send({ animals: TEST_DATA.animals });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.imported).toBe(1);
  });

  it('应该成功导入传感器告警数据', async () => {
    const res = await request('http://localhost:3001')
      .post('/api/import/sensor-alerts')
      .send({ alerts: TEST_DATA.sensorAlerts });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.imported).toBe(1);
  });
});

describe('数据查询接口', () => {
  it('应该能查询动物列表', async () => {
    const res = await request('http://localhost:3001')
      .get('/api/query/animals');
    
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('应该能查询笼位列表', async () => {
    const res = await request('http://localhost:3001')
      .get('/api/query/cages');
    
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('应该能查询告警列表', async () => {
    const res = await request('http://localhost:3001')
      .get('/api/query/alerts');
    
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('应该能查询仪表板数据', async () => {
    const res = await request('http://localhost:3001')
      .get('/api/query/dashboard');
    
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });
});

describe('规则引擎接口', () => {
  it('应该能运行所有校验规则', async () => {
    const res = await request('http://localhost:3001')
      .post('/api/query/rules/run-all');
    
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.results).toBeDefined();
  });
});

describe('数据导出接口', () => {
  it('应该能导出Markdown复盘报告', async () => {
    const res = await request('http://localhost:3001')
      .get('/api/export/markdown/review');
    
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/markdown|json/);
  });

  it('应该能导出CSV风险清单', async () => {
    const res = await request('http://localhost:3001')
      .get('/api/export/csv/risk-list');
    
    expect(res.statusCode).toBe(200);
  });

  it('应该能导出JSON审计包', async () => {
    const res = await request('http://localhost:3001')
      .get('/api/export/json/audit-package');
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toBeDefined();
  });
});

describe('404处理', () => {
  it('应该对不存在的路由返回404', async () => {
    const res = await request('http://localhost:3001')
      .get('/api/nonexistent');
    
    expect(res.statusCode).toBe(404);
  });
});
