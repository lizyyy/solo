const request = require('supertest');
const { v4: uuidv4 } = require('uuid');
const app = require('../src/app');
const db = require('../src/database/db');

let emp1Id, emp2Id;
let sub1Id, sub2Id, sub3Id;
let order1Id, order2Id;

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function runExecute(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

beforeAll(async () => {
  emp1Id = uuidv4();
  emp2Id = uuidv4();
  sub1Id = uuidv4();
  sub2Id = uuidv4();
  sub3Id = uuidv4();
  order1Id = uuidv4();
  order2Id = uuidv4();

  await runExecute(
    'INSERT INTO employees (id, name, department) VALUES (?, ?, ?)',
    [emp1Id, '张三', '技术部']
  );
  await runExecute(
    'INSERT INTO employees (id, name, department) VALUES (?, ?, ?)',
    [emp2Id, '李四', '财务部']
  );

  await runExecute(
    'INSERT INTO budget_subjects (id, name, code, total_budget, used_budget) VALUES (?, ?, ?, ?, ?)',
    [sub1Id, '差旅费', 'TRAVEL001', 100000, 0]
  );
  await runExecute(
    'INSERT INTO budget_subjects (id, name, code, total_budget, used_budget) VALUES (?, ?, ?, ?, ?)',
    [sub2Id, '办公费', 'OFFICE001', 50000, 0]
  );
  await runExecute(
    'INSERT INTO budget_subjects (id, name, code, total_budget, used_budget) VALUES (?, ?, ?, ?, ?)',
    [sub3Id, '招待费', 'ENTERTAIN001', 1000, 0]
  );

  await runExecute(
    'INSERT INTO reimbursement_orders (id, employee_id, amount, budget_subject_id, status) VALUES (?, ?, ?, ?, ?)',
    [order1Id, emp1Id, 5000, sub1Id, 'pending']
  );
  await runExecute(
    'INSERT INTO reimbursement_orders (id, employee_id, amount, budget_subject_id, status) VALUES (?, ?, ?, ?, ?)',
    [order2Id, emp2Id, 3000, sub2Id, 'pending']
  );
});

afterAll((done) => {
  db.close(done);
});

describe('预算科目调拨API测试', () => {
  describe('正常流程测试', () => {
    it('应该成功创建调拨申请', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .send({
          employeeId: emp1Id,
          reimbursementOrderId: order1Id,
          originalSubjectId: sub1Id,
          targetSubjectId: sub2Id,
          transferAmount: 5000,
          flowType: 'normal'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('pending');
    });

    it('应该成功处理调拨', async () => {
      const createRes = await request(app)
        .post('/api/transfers')
        .send({
          employeeId: emp1Id,
          reimbursementOrderId: order2Id,
          originalSubjectId: sub2Id,
          targetSubjectId: sub1Id,
          transferAmount: 3000,
          flowType: 'normal'
        });

      const transferId = createRes.body.data.id;
      const res = await request(app)
        .post('/api/transfers/process')
        .send({
          transferId: transferId,
          reviewerId: emp2Id
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('transferring');
    });

    it('应该成功入账', async () => {
      const createRes = await request(app)
        .post('/api/transfers')
        .send({
          employeeId: emp1Id,
          reimbursementOrderId: order1Id,
          originalSubjectId: sub1Id,
          targetSubjectId: sub2Id,
          transferAmount: 5000,
          flowType: 'normal'
        });

      const transferId = createRes.body.data.id;
      await request(app)
        .post('/api/transfers/process')
        .send({
          transferId: transferId,
          reviewerId: emp2Id
        });

      const res = await request(app)
        .post('/api/transfers/confirm')
        .send({
          transferId: transferId,
          reviewerId: emp2Id,
          paymentAmount: 5000
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('booked');
    });
  });

  describe('测试1: 预算占用和付款金额不一致', () => {
    it('应该拒绝不一致的付款金额', async () => {
      const createRes = await request(app)
        .post('/api/transfers')
        .send({
          employeeId: emp1Id,
          reimbursementOrderId: order2Id,
          originalSubjectId: sub2Id,
          targetSubjectId: sub1Id,
          transferAmount: 3000,
          flowType: 'normal'
        });

      const transferId = createRes.body.data.id;
      await request(app)
        .post('/api/transfers/process')
        .send({
          transferId: transferId,
          reviewerId: emp2Id
        });

      const res = await request(app)
        .post('/api/transfers/confirm')
        .send({
          transferId: transferId,
          reviewerId: emp2Id,
          paymentAmount: 3500
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('付款金额与调拨金额不一致');
    });
  });

  describe('测试2: 重复请求', () => {
    it('应该拒绝同一报销单的重复调拨', async () => {
      const newOrderId = uuidv4();
      await runExecute(
        'INSERT INTO reimbursement_orders (id, employee_id, amount, budget_subject_id, status) VALUES (?, ?, ?, ?, ?)',
        [newOrderId, emp1Id, 6000, sub1Id, 'pending']
      );

      await request(app)
        .post('/api/transfers')
        .send({
          employeeId: emp1Id,
          reimbursementOrderId: newOrderId,
          originalSubjectId: sub1Id,
          targetSubjectId: sub2Id,
          transferAmount: 6000,
          flowType: 'normal'
        });

      const res = await request(app)
        .post('/api/transfers')
        .send({
          employeeId: emp1Id,
          reimbursementOrderId: newOrderId,
          originalSubjectId: sub1Id,
          targetSubjectId: sub3Id,
          transferAmount: 6000,
          flowType: 'normal'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('存在进行中的调拨记录');
    });
  });

  describe('测试3: 撤回后再提交', () => {
    it('应该支持驳回后重新提交', async () => {
      const newOrderId = uuidv4();
      await runExecute(
        'INSERT INTO reimbursement_orders (id, employee_id, amount, budget_subject_id, status) VALUES (?, ?, ?, ?, ?)',
        [newOrderId, emp1Id, 7000, sub1Id, 'pending']
      );

      const createRes = await request(app)
        .post('/api/transfers')
        .send({
          employeeId: emp1Id,
          reimbursementOrderId: newOrderId,
          originalSubjectId: sub1Id,
          targetSubjectId: sub2Id,
          transferAmount: 7000,
          flowType: 'normal'
        });

      const transferId = createRes.body.data.id;

      const rejectRes = await request(app)
        .post('/api/transfers/reject')
        .send({
          transferId: transferId,
          reviewerId: emp2Id,
          reason: '科目选择错误，请重新选择'
        });

      expect(rejectRes.statusCode).toBe(200);
      expect(rejectRes.body.data.status).toBe('returned');

      const resubmitRes = await request(app)
        .post('/api/transfers/resubmit')
        .send({
          transferId: transferId,
          employeeId: emp1Id,
          targetSubjectId: sub3Id,
          transferAmount: 7000
        });

      expect(resubmitRes.statusCode).toBe(200);
      expect(resubmitRes.body.data.status).toBe('pending');
      expect(resubmitRes.body.data.flow_type).toBe('reject');
    });
  });

  describe('列表、详情、历史查询', () => {
    it('应该返回调拨列表', async () => {
      const res = await request(app).get('/api/transfers');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('应该返回调拨详情', async () => {
      const listRes = await request(app).get('/api/transfers');
      const transferId = listRes.body.data[0].id;

      const res = await request(app).get(`/api/transfers/${transferId}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(transferId);
    });

    it('应该返回调拨历史', async () => {
      const listRes = await request(app).get('/api/transfers');
      const transferId = listRes.body.data[0].id;

      const res = await request(app).get(`/api/transfers/${transferId}/history`);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('导入坏行', () => {
    it('应该正确处理导入中的坏行', async () => {
      const res = await request(app)
        .post('/api/transfers/import')
        .send({
          rows: [
            {
              employeeId: emp1Id,
              reimbursementOrderId: order1Id,
              originalSubjectId: sub1Id,
              targetSubjectId: sub2Id,
              transferAmount: 5000
            },
            {
              employeeId: emp1Id,
              reimbursementOrderId: 'non-existent-id',
              originalSubjectId: sub1Id,
              targetSubjectId: sub2Id,
              transferAmount: 5000
            },
            {
              employeeId: emp2Id,
              reimbursementOrderId: order2Id,
              originalSubjectId: sub2Id,
              targetSubjectId: sub1Id,
              transferAmount: 3000
            }
          ],
          fileName: 'test_import.csv'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.failed).toBeGreaterThan(0);
      expect(res.body.data.errors.length).toBeGreaterThan(0);
    });
  });

  describe('人工复核流程', () => {
    it('应该支持人工复核通过', async () => {
      const newOrderId = uuidv4();
      await runExecute(
        'INSERT INTO reimbursement_orders (id, employee_id, amount, budget_subject_id, status) VALUES (?, ?, ?, ?, ?)',
        [newOrderId, emp1Id, 9000, sub1Id, 'pending']
      );

      const createRes = await request(app)
        .post('/api/transfers')
        .send({
          employeeId: emp1Id,
          reimbursementOrderId: newOrderId,
          originalSubjectId: sub1Id,
          targetSubjectId: sub2Id,
          transferAmount: 9000,
          flowType: 'manual_review'
        });

      const transferId = createRes.body.data.id;

      const reviewRes = await request(app)
        .post('/api/transfers/manual-review')
        .send({
          transferId: transferId,
          reviewerId: emp2Id,
          approved: true,
          comment: '审核通过'
        });

      expect(reviewRes.statusCode).toBe(200);
      expect(reviewRes.body.data.status).toBe('transferring');
    });
  });
});
