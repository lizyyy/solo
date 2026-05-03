const request = require('supertest');
const app = require('../src/app');
const { Flatmate, Bill, SplitRule, PaymentRecord } = require('../src/models');
const { createTestFlatmates } = require('./setup');

describe('Payment API', () => {
  let testFlatmates;
  let testBill;
  let testSplitRules;
  
  beforeEach(async () => {
    testFlatmates = await createTestFlatmates();
    
    // 创建一个测试账单
    testBill = await Bill.create({
      title: '测试账单',
      total_amount: 300.00,
      split_type: 'equal',
      status: 'pending',
      creator_id: testFlatmates[0].id,
    });
    
    // 创建分摊规则
    testSplitRules = await SplitRule.bulkCreate([
      {
        bill_id: testBill.id,
        flatmate_id: testFlatmates[0].id,
        split_type: 'equal',
        ratio: 0.3333,
        amount: 100.00,
        status: 'pending',
      },
      {
        bill_id: testBill.id,
        flatmate_id: testFlatmates[1].id,
        split_type: 'equal',
        ratio: 0.3333,
        amount: 100.00,
        status: 'pending',
      },
      {
        bill_id: testBill.id,
        flatmate_id: testFlatmates[2].id,
        split_type: 'equal',
        ratio: 0.3334,
        amount: 100.00,
        status: 'pending',
      },
    ]);
  });

  describe('POST /api/v1/payments', () => {
    it('should record a payment', async () => {
      const paymentData = {
        bill_id: testBill.id,
        split_rule_id: testSplitRules[0].id,
        amount: 100.00,
        payment_method: 'wechat',
      };
      
      const res = await request(app)
        .post('/api/v1/payments')
        .set('x-user-id', testFlatmates[0].id)
        .send(paymentData);
      
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payment.amount).toBe('100.00');
    });

    it('should record payment with points', async () => {
      // 给第一个用户有100积分，可以抵扣10元
      const paymentData = {
        bill_id: testBill.id,
        split_rule_id: testSplitRules[0].id,
        amount: 90.00,
        use_points: true,
        points_to_use: 100,
        payment_method: 'wechat',
      };
      
      const res = await request(app)
        .post('/api/v1/payments')
        .set('x-user-id', testFlatmates[0].id)
        .send(paymentData);
      
      expect(res.statusCode).toBe(201);
      expect(parseFloat(res.body.data.payment.points_used)).toBeGreaterThan(0);
    });

    it('should return error when amount exceeds remaining', async () => {
      const paymentData = {
        bill_id: testBill.id,
        split_rule_id: testSplitRules[0].id,
        amount: 200.00, // 超过应付的100元
        payment_method: 'wechat',
      };
      
      const res = await request(app)
        .post('/api/v1/payments')
        .set('x-user-id', testFlatmates[0].id)
        .send(paymentData);
      
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/payments/confirm', () => {
    let testPayment;
    
    beforeEach(async () => {
      // 创建一个待确认的付款记录
      testPayment = await PaymentRecord.create({
        bill_id: testBill.id,
        split_rule_id: testSplitRules[0].id,
        payer_id: testFlatmates[1].id,
        receiver_id: testFlatmates[0].id,
        amount: 100.00,
        status: 'pending',
        payment_method: 'alipay',
      });
    });

    it('should confirm a pending payment', async () => {
      const res = await request(app)
        .post('/api/v1/payments/confirm')
        .set('x-user-id', testFlatmates[0].id)
        .send({
          payment_id: testPayment.id,
        });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.payment.status).toBe('confirmed');
    });

    it('should return error for already confirmed payment', async () => {
      // 先确认付款
      await PaymentRecord.update(
        { status: 'confirmed' },
        { where: { id: testPayment.id } }
      );
      
      const res = await request(app)
        .post('/api/v1/payments/confirm')
        .set('x-user-id', testFlatmates[0].id)
        .send({
          payment_id: testPayment.id,
        });
      
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/payments/:id/reject', () => {
    let testPayment;
    
    beforeEach(async () => {
      testPayment = await PaymentRecord.create({
        bill_id: testBill.id,
        split_rule_id: testSplitRules[0].id,
        payer_id: testFlatmates[1].id,
        receiver_id: testFlatmates[0].id,
        amount: 100.00,
        status: 'pending',
        payment_method: 'alipay',
      });
    });

    it('should reject a payment', async () => {
      const res = await request(app)
        .post(`/api/v1/payments/${testPayment.id}/reject`)
        .set('x-user-id', testFlatmates[0].id)
        .send({
          rejection_reason: '金额不对',
        });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.payment.status).toBe('rejected');
    });
  });

  describe('GET /api/v1/payments/my', () => {
    beforeEach(async () => {
      // 为第一个用户创建一些付款记录
      await PaymentRecord.create({
        bill_id: testBill.id,
        payer_id: testFlatmates[0].id,
        amount: 50.00,
        status: 'confirmed',
        payment_method: 'wechat',
      });
      
      await PaymentRecord.create({
        bill_id: testBill.id,
        payer_id: testFlatmates[0].id,
        amount: 50.00,
        status: 'pending',
        payment_method: 'alipay',
      });
    });

    it('should return my payments', async () => {
      const res = await request(app)
        .get('/api/v1/payments/my')
        .set('x-user-id', testFlatmates[0].id);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.payments.length).toBe(2);
    });
  });

  describe('GET /api/v1/payments/to-confirm', () => {
    beforeEach(async () => {
      // 创建待确认的付款记录（收款人是第一个用户）
      await PaymentRecord.create({
        bill_id: testBill.id,
        payer_id: testFlatmates[1].id,
        receiver_id: testFlatmates[0].id,
        amount: 100.00,
        status: 'pending',
        payment_method: 'wechat',
      });
    });

    it('should return payments to confirm', async () => {
      const res = await request(app)
        .get('/api/v1/payments/to-confirm')
        .set('x-user-id', testFlatmates[0].id);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.payments_to_confirm.length).toBe(1);
    });
  });

  describe('Payment Flow Integration', () => {
    it('should complete full payment flow: create -> record -> confirm', async () => {
      // 1. 创建账单
      const billRes = await request(app)
        .post('/api/v1/bills')
        .set('x-user-id', testFlatmates[0].id)
        .send({
          title: '完整流程测试',
          total_amount: 200.00,
          split_type: 'ratio',
          split_config: {
            ratios: [
              { flatmate_id: testFlatmates[0].id, ratio: 0.5 },
              { flatmate_id: testFlatmates[1].id, ratio: 0.5 },
            ],
          },
        });
      
      expect(billRes.statusCode).toBe(201);
      const billId = billRes.body.data.bill.id;
      const splitRules = billRes.body.data.split_rules;
      
      // 找到用户2的分摊规则
      const splitRuleUser2 = splitRules.find(r => r.flatmate_id === testFlatmates[1].id);
      
      // 2. 用户2记录付款
      const paymentRes = await request(app)
        .post('/api/v1/payments')
        .set('x-user-id', testFlatmates[1].id)
        .send({
          bill_id: billId,
          split_rule_id: splitRuleUser2.id,
          amount: 100.00,
          receiver_id: testFlatmates[0].id,
          payment_method: 'alipay',
        });
      
      expect(paymentRes.statusCode).toBe(201);
      const paymentId = paymentRes.body.data.payment.id;
      
      // 3. 用户1确认付款
      const confirmRes = await request(app)
        .post('/api/v1/payments/confirm')
        .set('x-user-id', testFlatmates[0].id)
        .send({
          payment_id: paymentId,
        });
      
      expect(confirmRes.statusCode).toBe(200);
      expect(confirmRes.body.data.payment.status).toBe('confirmed');
    });
  });
});
