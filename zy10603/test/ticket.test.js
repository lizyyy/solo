const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const db = require('../src/database');

const dataDir = path.join(__dirname, '../data');
const testDbPath = path.join(dataDir, 'test_tickets.db');

jest.mock('../src/database', () => {
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  const fs = require('fs');
  
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const db = new sqlite3.Database(':memory:');
  
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL UNIQUE,
      bot_tag TEXT NOT NULL,
      human_queue TEXT NOT NULL,
      customer_emotion TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'AUTO_PROCESS',
      conflict_count INTEGER DEFAULT 0,
      last_conflict_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ticket_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      action TEXT NOT NULL,
      operator TEXT DEFAULT 'system',
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS import_validation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      row_number INTEGER NOT NULL,
      session_id TEXT,
      is_valid BOOLEAN NOT NULL,
      errors TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  });

  return db;
});

describe('客服工单平台 API 测试', () => {

  describe('1. 完整流转测试', () => {
    let ticketId;

    test('创建工单', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .send({
          session_id: 'FLOW_001',
          bot_tag: 'test_bot',
          human_queue: 'general',
          customer_emotion: 'neutral'
        });
      
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('AUTO_PROCESS');
      ticketId = res.body.data.id;
    });

    test('查看工单详情', async () => {
      const res = await request(app).get(`/api/tickets/${ticketId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.session_id).toBe('FLOW_001');
    });

    test('状态变更: 自动处理 -> 待复核', async () => {
      const res = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .send({
          status: 'PENDING_REVIEW',
          operator: 'agent_01',
          remark: '机器人判定存疑，待人工复核'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.new_status).toBe('PENDING_REVIEW');
      expect(res.body.data.is_conflict).toBe(false);
    });

    test('状态变更: 待复核 -> 已转人工', async () => {
      const res = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .send({
          status: 'TRANSFERRED_TO_HUMAN',
          operator: 'supervisor',
          remark: '复核通过，转人工客服处理'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.new_status).toBe('TRANSFERRED_TO_HUMAN');
    });

    test('状态变更: 已转人工 -> 已关闭', async () => {
      const res = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .send({
          status: 'CLOSED',
          operator: 'agent_01',
          remark: '客户问题已解决'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.new_status).toBe('CLOSED');
    });

    test('查看历史记录 - 应包含所有状态变更', async () => {
      const res = await request(app).get(`/api/tickets/${ticketId}/history`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
      
      const actions = res.body.data.map(h => h.action);
      expect(actions).toContain('create');
      expect(actions.filter(a => a === 'status_update').length).toBe(3);
    });

    test('列表查询 - 工单应在列表中', async () => {
      const res = await request(app).get('/api/tickets');
      expect(res.status).toBe(200);
      const sessionIds = res.body.data.map(t => t.session_id);
      expect(sessionIds).toContain('FLOW_001');
    });
  });

  describe('2. 冲突记录测试', () => {
    let ticketId;

    test('创建测试工单', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .send({
          session_id: 'CONFLICT_001',
          bot_tag: 'conflict_bot',
          human_queue: 'technical',
          customer_emotion: 'angry',
          status: 'TRANSFERRED_TO_HUMAN'
        });
      expect(res.status).toBe(201);
      ticketId = res.body.data.id;
    });

    test('第一次转回自助流程 - 检测到冲突', async () => {
      const res = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .send({
          status: 'AUTO_PROCESS',
          operator: 'bot_system'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.is_conflict).toBe(true);
      expect(res.body.data.conflict_count).toBe(1);
    });

    test('历史记录应标记冲突动作', async () => {
      const res = await request(app).get(`/api/tickets/${ticketId}/history`);
      expect(res.status).toBe(200);
      
      const conflictActions = res.body.data.filter(h => h.action === 'conflict_transfer');
      expect(conflictActions.length).toBe(1);
      expect(conflictActions[0].remark).toContain('冲突');
    });

    test('第二次转回自助流程 - 冲突次数累计', async () => {
      await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .send({ status: 'TRANSFERRED_TO_HUMAN' });

      const res = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .send({
          status: 'AUTO_PROCESS',
          operator: 'bot_system'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.data.is_conflict).toBe(true);
      expect(res.body.data.conflict_count).toBe(2);
    });

    test('工单详情显示冲突次数', async () => {
      const res = await request(app).get(`/api/tickets/${ticketId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.conflict_count).toBe(2);
    });
  });

  describe('3. 导入坏行测试', () => {
    const testCsvPath = path.join(dataDir, 'test_import.csv');

    beforeAll(() => {
      const csvContent = `session_id,bot_tag,human_queue,customer_emotion
IMPORT_001,valid_bot,general,neutral
IMPORT_002,,billing,happy
IMPORT_003,valid_bot,invalid_queue,angry
,empty_bot,general,negative`;
      fs.writeFileSync(testCsvPath, csvContent);
    });

    afterAll(() => {
      if (fs.existsSync(testCsvPath)) {
        fs.unlinkSync(testCsvPath);
      }
    });

    test('导入CSV - 部分行验证失败', async () => {
      const res = await request(app)
        .post('/api/tickets/import')
        .send({ filePath: testCsvPath });
      
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(4);
      expect(res.body.data.valid).toBe(1);
      expect(res.body.data.invalid).toBe(3);
    });

    test('查看行级校验结果', async () => {
      const importRes = await request(app)
        .post('/api/tickets/import')
        .send({ filePath: testCsvPath });
      
      const batchId = importRes.body.data.batchId;
      const res = await request(app).get(`/api/tickets/${batchId}/validation`);
      
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(4);
      
      const row2 = res.body.data.find(r => r.row_number === 2);
      expect(row2.is_valid).toBe(0);
      
      const row3 = res.body.data.find(r => r.row_number === 3);
      expect(row3.is_valid).toBe(0);
      
      const row4 = res.body.data.find(r => r.row_number === 4);
      expect(row4.is_valid).toBe(0);
    });

    test('校验错误应包含具体字段和消息', async () => {
      const importRes = await request(app)
        .post('/api/tickets/import')
        .send({ filePath: testCsvPath });
      
      const batchId = importRes.body.data.batchId;
      const res = await request(app).get(`/api/tickets/${batchId}/validation`);
      
      const badRows = res.body.data.filter(r => !r.is_valid);
      badRows.forEach(row => {
        expect(row.errors.length).toBeGreaterThan(0);
        row.errors.forEach(err => {
          expect(err).toHaveProperty('field');
          expect(err).toHaveProperty('message');
        });
      });
    });
  });

  describe('4. 数据一致性验证', () => {
    let ticketId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/tickets')
        .send({
          session_id: 'EXPORT_001',
          bot_tag: 'export_bot',
          human_queue: 'billing',
          customer_emotion: 'negative'
        });
      ticketId = res.body.data.id;
      
      await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
        .send({ status: 'PENDING_REVIEW' });
    });

    test('列表、详情、历史数据一致', async () => {
      const listRes = await request(app).get('/api/tickets');
      const listTicket = listRes.body.data.find(t => t.session_id === 'EXPORT_001');
      
      const detailRes = await request(app).get(`/api/tickets/${ticketId}`);
      const historyRes = await request(app).get(`/api/tickets/${ticketId}/history`);
      
      expect(listTicket.status).toBe(detailRes.body.data.status);
      expect(listTicket.session_id).toBe(detailRes.body.data.session_id);
      
      const statusInHistory = historyRes.body.data.map(h => h.new_status);
      expect(statusInHistory).toContain(detailRes.body.data.status);
    });
  });

  describe('5. 边界测试', () => {
    test('创建工单 - 必填字段缺失应返回明确错误', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .send({
          bot_tag: 'test_bot'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('会话编号');
    });

    test('创建工单 - 枚举值非法应返回明确错误', async () => {
      const res = await request(app)
        .post('/api/tickets')
        .send({
          session_id: 'INVALID_001',
          bot_tag: 'test_bot',
          human_queue: 'invalid_queue',
          customer_emotion: 'happy'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('人工队列');
      expect(res.body.error).toContain('客户情绪');
    });

    test('查询不存在的工单应返回404', async () => {
      const res = await request(app).get('/api/tickets/999999');
      expect(res.status).toBe(404);
    });
  });
});
