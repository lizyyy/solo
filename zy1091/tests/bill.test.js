const request = require('supertest');
const app = require('../src/app');
const { Flatmate, Bill, SplitRule } = require('../src/models');
const { createTestFlatmates } = require('./setup');

describe('Bill API', () => {
  let testFlatmates;
  
  beforeEach(async () => {
    testFlatmates = await createTestFlatmates();
  });

  describe('POST /api/v1/bills', () => {
    it('should create a bill with equal split', async () => {
      const billData = {
        title: '测试水电费',
        description: '月度水电费',
        category: 'utility',
        total_amount: 300.00,
        split_type: 'equal',
        due_date: '2024-12-31',
      };
      
      const res = await request(app)
        .post('/api/v1/bills')
        .set('x-user-id', testFlatmates[0].id)
        .send(billData);
      
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bill.title).toBe('测试水电费');
      expect(res.body.data.split_rules.length).toBe(3); // 3个室友均摊
      expect(res.body.data.split_rules[0].amount).toBe('100.00');
    });

    it('should create a bill with ratio split', async () => {
      const billData = {
        title: '测试公共用品',
        description: '按比例分摊',
        category: 'supplies',
        total_amount: 100.00,
        split_type: 'ratio',
        split_config: {
          ratios: [
            { flatmate_id: testFlatmates[0].id, ratio: 0.5 },
            { flatmate_id: testFlatmates[1].id, ratio: 0.3 },
            { flatmate_id: testFlatmates[2].id, ratio: 0.2 },
          ],
        },
      };
      
      const res = await request(app)
        .post('/api/v1/bills')
        .set('x-user-id', testFlatmates[0].id)
        .send(billData);
      
      expect(res.statusCode).toBe(201);
      expect(res.body.data.split_rules.length).toBe(3);
      
      // 检查比例分摊是否正确
      const amounts = res.body.data.split_rules.map(r => parseFloat(r.amount));
      expect(amounts).toContain(50.00);
      expect(amounts).toContain(30.00);
      expect(amounts).toContain(20.00);
    });

    it('should create a bill with specific split', async () => {
      const billData = {
        title: '测试网络费',
        description: '只有两个人用网络',
        category: 'service',
        total_amount: 200.00,
        split_type: 'specific',
        split_config: {
          assignments: [
            { flatmate_id: testFlatmates[0].id, amount: 100 },
            { flatmate_id: testFlatmates[1].id, amount: 100 },
          ],
        },
      };
      
      const res = await request(app)
        .post('/api/v1/bills')
        .set('x-user-id', testFlatmates[0].id)
        .send(billData);
      
      expect(res.statusCode).toBe(201);
      expect(res.body.data.split_rules.length).toBe(2); // 只有两个人分摊
    });

    it('should create a bill with advance split', async () => {
      const billData = {
        title: '测试房租',
        description: '张三垫付，其他人后续报销',
        category: 'rent',
        total_amount: 9000.00,
        split_type: 'advance',
        advanced_by_id: testFlatmates[0].id,
      };
      
      const res = await request(app)
        .post('/api/v1/bills')
        .set('x-user-id', testFlatmates[0].id)
        .send(billData);
      
      expect(res.statusCode).toBe(201);
      expect(res.body.data.split_rules.length).toBe(3);
      
      // 检查垫付人状态是否为已支付
      const advancedRule = res.body.data.split_rules.find(r => r.is_advanced_by);
      expect(advancedRule.status).toBe('paid');
    });

    it('should return error for invalid split type', async () => {
      const billData = {
        title: '测试账单',
        total_amount: 100.00,
        split_type: 'invalid_type',
      };
      
      const res = await request(app)
        .post('/api/v1/bills')
        .set('x-user-id', testFlatmates[0].id)
        .send(billData);
      
      expect(res.statusCode).toBe(400);
    });

    it('should return error for ratio not summing to 100%', async () => {
      const billData = {
        title: '测试账单',
        total_amount: 100.00,
        split_type: 'ratio',
        split_config: {
          ratios: [
            { flatmate_id: testFlatmates[0].id, ratio: 0.5 },
            { flatmate_id: testFlatmates[1].id, ratio: 0.3 },
            // 只有 80%，缺少 20%
          ],
        },
      };
      
      const res = await request(app)
        .post('/api/v1/bills')
        .set('x-user-id', testFlatmates[0].id)
        .send(billData);
      
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/bills', () => {
    it('should return all bills', async () => {
      await Bill.create({
        title: '账单1',
        total_amount: 100,
        split_type: 'equal',
        creator_id: testFlatmates[0].id,
      });
      
      await Bill.create({
        title: '账单2',
        total_amount: 200,
        split_type: 'equal',
        creator_id: testFlatmates[0].id,
      });
      
      const res = await request(app).get('/api/v1/bills');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.bills.length).toBe(2);
    });
  });

  describe('GET /api/v1/bills/balance/summary', () => {
    it('should return balance summary', async () => {
      const res = await request(app).get('/api/v1/bills/balance/summary');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.summary.total_active_flatmates).toBe(3);
    });
  });

  describe('GET /api/v1/bills/statement/:flatmate_id', () => {
    it('should return flatmate statement', async () => {
      const res = await request(app)
        .get(`/api/v1/bills/statement/${testFlatmates[0].id}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.statement).toBeDefined();
    });
  });

  describe('Bill Split Logic', () => {
    it('should generate correct equal split for 3 people', async () => {
      const billData = {
        title: '均摊测试',
        total_amount: 300.00,
        split_type: 'equal',
      };
      
      const res = await request(app)
        .post('/api/v1/bills')
        .set('x-user-id', testFlatmates[0].id)
        .send(billData);
      
      const splitRules = res.body.data.split_rules;
      
      // 每个人应该分摊 100 元
      for (const rule of splitRules) {
        expect(parseFloat(rule.amount)).toBeCloseTo(100, 2);
      }
      
      // 检查总金额是否正确
      const total = splitRules.reduce((sum, r) => sum + parseFloat(r.amount), 0);
      expect(total).toBeCloseTo(300, 2);
    });

    it('should generate correct ratio split', async () => {
      const billData = {
        title: '比例分摊测试',
        total_amount: 1000.00,
        split_type: 'ratio',
        split_config: {
          ratios: [
            { flatmate_id: testFlatmates[0].id, ratio: 0.5 },  // 500
            { flatmate_id: testFlatmates[1].id, ratio: 0.3 },  // 300
            { flatmate_id: testFlatmates[2].id, ratio: 0.2 },  // 200
          ],
        },
      };
      
      const res = await request(app)
        .post('/api/v1/bills')
        .set('x-user-id', testFlatmates[0].id)
        .send(billData);
      
      const splitRules = res.body.data.split_rules;
      
      // 检查每个人的分摊金额
      const rule0 = splitRules.find(r => r.flatmate_id === testFlatmates[0].id);
      const rule1 = splitRules.find(r => r.flatmate_id === testFlatmates[1].id);
      const rule2 = splitRules.find(r => r.flatmate_id === testFlatmates[2].id);
      
      expect(parseFloat(rule0.amount)).toBeCloseTo(500, 2);
      expect(parseFloat(rule1.amount)).toBeCloseTo(300, 2);
      expect(parseFloat(rule2.amount)).toBeCloseTo(200, 2);
    });
  });
});
