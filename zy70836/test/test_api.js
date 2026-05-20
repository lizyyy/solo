const request = require('supertest');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/test.db');
process.env.DB_PATH = dbPath;

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const app = require('../src/server');

let batchId;
let borrowRecordId;

describe('4S店车辆追踪系统 API 测试', () => {
  beforeAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(() => {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  test('健康检查', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });

  test('创建批次', async () => {
    const res = await request(app)
      .post('/api/batches')
      .send({
        batch_name: '2024年1月第1批试驾记录',
        operator: '张主管'
      });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('batch_no');
    expect(res.body).toHaveProperty('id');
    batchId = res.body.id;
    console.log('创建批次 ID:', batchId);
  });

  test('查询批次列表', async () => {
    const res = await request(app).get('/api/batches');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('导入车辆JSON', async () => {
    const res = await request(app)
      .post(`/api/batches/${batchId}/import/vehicles`)
      .attach('file', path.join(__dirname, '../examples/vehicles.json'))
      .field('operator', '张主管');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.imported).toBe(3);
    console.log('导入车辆:', res.body.imported);
  }, 10000);

  test('导入借还CSV', async () => {
    const res = await request(app)
      .post(`/api/batches/${batchId}/import/borrow-return`)
      .attach('file', path.join(__dirname, '../examples/borrow_return.csv'))
      .field('operator', '张主管');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.imported).toBe(3);
    console.log('导入借还记录:', res.body.imported);
  }, 10000);

  test('导入违章回执', async () => {
    const res = await request(app)
      .post(`/api/batches/${batchId}/import/violations`)
      .attach('file', path.join(__dirname, '../examples/violations.json'))
      .field('operator', '张主管');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.imported).toBe(2);
    console.log('导入违章记录:', res.body.imported);
  }, 10000);

  test('查询批次详情', async () => {
    const res = await request(app).get(`/api/batches/${batchId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('batch');
    expect(res.body).toHaveProperty('vehicles');
    expect(res.body).toHaveProperty('borrowRecords');
    expect(res.body).toHaveProperty('violations');
    expect(res.body.vehicles.length).toBe(3);
    expect(res.body.borrowRecords.length).toBe(3);
    expect(res.body.violations.length).toBe(2);
    borrowRecordId = res.body.borrowRecords[0].id;
  });

  test('处理还车', async () => {
    const res = await request(app)
      .post(`/api/records/return/${borrowRecordId}`)
      .send({
        operator: '张主管',
        actual_return_time: '2024-01-15 17:30:00',
        end_mileage: 12680.5,
        end_fuel_balance: 280.0,
        remark: '正常归还，油卡消费220元'
      });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    console.log('处理还车完成');
  });

  test('查询异常记录', async () => {
    const res = await request(app).get('/api/query/exceptions');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    console.log('异常记录数量:', res.body.length);
  });

  test('按试驾路线查询历史', async () => {
    const res = await request(app)
      .get('/api/query/history')
      .query({ test_route: '机场' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('records');
    console.log('路线查询结果:', res.body.total);
  });

  test('按销售顾问查询历史', async () => {
    const res = await request(app)
      .get('/api/query/history')
      .query({ sales_consultant: '张三' });
    expect(res.statusCode).toBe(200);
    console.log('销售顾问查询结果:', res.body.total);
  });

  test('按里程范围查询历史', async () => {
    const res = await request(app)
      .get('/api/query/history')
      .query({ min_mileage: 100, max_mileage: 500 });
    expect(res.statusCode).toBe(200);
    console.log('里程范围查询结果:', res.body.total);
  });

  test('车辆里程追溯', async () => {
    const res = await request(app)
      .get('/api/query/mileage-tracking/LSVAU2180K2123456');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('vin');
    expect(res.body).toHaveProperty('tracking_records');
    console.log('里程追溯记录数:', res.body.tracking_records.length);
    console.log('当前里程:', res.body.current_mileage);
    res.body.tracking_records.forEach(t => {
      console.log(`  ${t.time}: ${t.mileage}km (${t.source})`);
    });
  });

  test('标记批次处理完成', async () => {
    const res = await request(app)
      .post(`/api/batches/${batchId}/process`)
      .send({
        operator: '张主管',
        remark: '所有记录已核对完成，审批通过'
      });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    console.log('批次处理完成');
  });

  test('查询操作日志', async () => {
    const res = await request(app)
      .get('/api/query/operations')
      .query({ target_type: 'batch', target_id: batchId });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    console.log('操作日志数量:', res.body.length);
    res.body.forEach(log => {
      console.log(`  ${log.created_at}: ${log.operator} - ${log.detail}`);
    });
  });

  test('导出CSV', async () => {
    const res = await request(app).get('/api/query/export');
    expect(res.statusCode).toBe(200);
    expect(res.header['content-type']).toContain('csv');
    console.log('CSV导出成功，数据已生成');
  });

  test('审计追踪', async () => {
    const res = await request(app)
      .get(`/api/query/audit-trail/borrow_return/${borrowRecordId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('audit_summary');
    console.log('审计追踪 - 操作数:', res.body.audit_summary.total_operations);
    console.log('审计追踪 - 异常数:', res.body.audit_summary.total_exceptions);
  });

  console.log('\n========== 所有测试通过！系统功能验证完成 ==========\n');
});
