const request = require('supertest');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'test_database.db');
process.env.TEST_DB = dbPath;

let app;
let db;

beforeAll(async () => {
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  
  const sqlite3 = require('sqlite3').verbose();
  db = new sqlite3.Database(dbPath);
  
  await new Promise((resolve, reject) => {
    db.run(`CREATE TABLE IF NOT EXISTS reschedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reschedule_no TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      original_shot_date TEXT NOT NULL,
      new_shot_date TEXT NOT NULL,
      original_route TEXT NOT NULL,
      new_route TEXT NOT NULL,
      scenic_spot TEXT NOT NULL,
      store TEXT NOT NULL,
      person_in_charge TEXT NOT NULL,
      reschedule_reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reschedule_fee REAL DEFAULT 0,
      remarks TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_reversed INTEGER DEFAULT 0,
      reversed_from INTEGER
    )`, (err) => err ? reject(err) : resolve());
  });

  await new Promise((resolve, reject) => {
    db.run(`CREATE TABLE IF NOT EXISTS reschedule_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reschedule_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      old_data TEXT,
      new_data TEXT,
      operator TEXT,
      operated_at TEXT NOT NULL,
      FOREIGN KEY (reschedule_id) REFERENCES reschedules(id)
    )`, (err) => err ? reject(err) : resolve());
  });

  jest.resetModules();
  const originalDatabase = require('../src/models/database');
  originalDatabase.db = db;
  
  app = require('../src/app');
});

afterAll((done) => {
  db.close(() => {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    done();
  });
});

describe('旅拍路线改期 API 测试', () => {
  let testRecordId;
  let completedRecordId;

  const validRecord = {
    customer_name: '测试客户',
    customer_phone: '13900139000',
    original_shot_date: '2024-07-01',
    new_shot_date: '2024-07-10',
    original_route: '测试路线A',
    new_route: '测试路线B',
    scenic_spot: '测试景区',
    store: '测试门店',
    person_in_charge: '测试负责人',
    reschedule_reason: '测试原因'
  };

  test('1. 创建改期记录 - 成功', async () => {
    const response = await request(app)
      .post('/api/reschedules')
      .send(validRecord);

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.customer_name).toBe('测试客户');
    expect(response.body.data.status).toBe('pending');
    testRecordId = response.body.data.id;
  });

  test('2. 重复调用创建接口 - 生成不同单号', async () => {
    const response1 = await request(app)
      .post('/api/reschedules')
      .send({ ...validRecord, customer_name: '重复测试1' });
    
    const response2 = await request(app)
      .post('/api/reschedules')
      .send({ ...validRecord, customer_name: '重复测试2' });

    expect(response1.body.data.reschedule_no).not.toBe(response2.body.data.reschedule_no);
  });

  test('3. 坏数据处理 - 缺少必填字段', async () => {
    const badRecord = {
      customer_name: '坏数据测试',
      scenic_spot: '测试景区'
    };

    const response = await request(app)
      .post('/api/reschedules')
      .send(badRecord);

    expect(response.statusCode).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('4. 查询改期列表 - 带筛选条件', async () => {
    const response = await request(app)
      .get('/api/reschedules')
      .query({ status: 'pending', store: '测试门店' });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test('5. 状态流转 - pending -> confirmed (有效)', async () => {
    const response = await request(app)
      .put(`/api/reschedules/${testRecordId}`)
      .send({ status: 'confirmed', operator: '测试员' });

    expect(response.statusCode).toBe(200);
    expect(response.body.data.status).toBe('confirmed');
  });

  test('6. 状态越级 - pending -> completed (无效)', async () => {
    const newRecord = await request(app)
      .post('/api/reschedules')
      .send({ ...validRecord, customer_name: '状态越级测试' });
    
    const response = await request(app)
      .put(`/api/reschedules/${newRecord.body.data.id}`)
      .send({ status: 'completed' });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toContain('无效的状态转换');
  });

  test('7. 创建已完成状态记录用于冲正测试', async () => {
    const response = await request(app)
      .post('/api/reschedules')
      .send({ ...validRecord, customer_name: '冲正测试客户', status: 'completed' });
    
    completedRecordId = response.body.data.id;
  });

  test('8. 冲正功能 - 已完成记录冲正', async () => {
    const response = await request(app)
      .post(`/api/reschedules/${completedRecordId}/reverse`)
      .send({ operator: '财务', reverse_reason: '发现费用计算错误' });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.original.is_reversed).toBe(1);
    expect(response.body.data.reversed.status).toBe('pending');
  });

  test('9. 历史记录查询', async () => {
    const response = await request(app)
      .get(`/api/reschedules/${testRecordId}/history`);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  test('10. 批量导入 - 含坏数据不中断整批', async () => {
    const batchRecords = [
      { ...validRecord, customer_name: '批量成功1' },
      { customer_name: '坏数据' },
      { ...validRecord, customer_name: '批量成功2' },
      {}
    ];

    const response = await request(app)
      .post('/api/reschedules/batch-import')
      .send({ records: batchRecords, operator: '批量操作员' });

    expect(response.statusCode).toBe(200);
    expect(response.body.data.total).toBe(4);
    expect(response.body.data.success.length).toBe(2);
    expect(response.body.data.failed.length).toBe(2);
  });

  test('11. 导出CSV功能', async () => {
    const response = await request(app)
      .get('/api/reschedules/export');

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('reschedule_no');
    expect(response.text).toContain('customer_name');
  });

  test('12. 查询单条记录', async () => {
    const response = await request(app)
      .get(`/api/reschedules/${testRecordId}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.data.id).toBe(testRecordId);
  });

  test('13. 健康检查', async () => {
    const response = await request(app).get('/health');
    expect(response.statusCode).toBe(200);
    expect(response.body.message).toContain('服务正常');
  });
});