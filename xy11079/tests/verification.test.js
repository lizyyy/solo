const request = require('supertest');
const app = require('../src/app');
const store = require('../src/storage/memoryStore');

describe('蛋糕预订台取货核验API测试', () => {
  
  beforeEach(() => {
    store.orders.clear();
    store.verifications.clear();
    store.histories.clear();
    store.initSampleData();
  });

  describe('订单列表和详情查询', () => {
    test('应该能获取订单列表', async () => {
      const response = await request(app).get('/api/orders');
      expect(response.status).toBe(200);
      expect(response.body.code).toBe('SUCCESS');
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    test('应该能按状态筛选订单', async () => {
      const response = await request(app).get('/api/orders?status=pending');
      expect(response.status).toBe(200);
      const pendingOrders = response.body.data.filter(o => o.status === 'pending');
      expect(pendingOrders.length).toBe(response.body.data.length);
    });

    test('应该能获取订单详情', async () => {
      const response = await request(app).get('/api/orders/ORD-202405001');
      expect(response.status).toBe(200);
      expect(response.body.data.orderNo).toBe('CAKE-20240518-001');
      expect(response.body.data.cakeName).toBeDefined();
      expect(response.body.data.customerPhone).toBeDefined();
    });

    test('应该能获取订单修改历史', async () => {
      const response = await request(app).get('/api/orders/ORD-202405002/history');
      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].field).toBeDefined();
    });
  });

  describe('边界情况1：代取人报错码但订单已被核销', () => {
    test('已核销订单应该返回ORDER_ALREADY_VERIFIED错误', async () => {
      const response = await request(app)
        .post('/api/verifications')
        .send({
          orderNo: 'CAKE-20240518-002',
          verificationCode: '654321',
          verificationType: 'proxy',
          proxyPicker: '测试代取人',
          proxyIdCard: '110101199001011234',
          proxyPhone: '13800138000',
          balancePaid: 98,
          paymentMethod: 'wechat',
          operator: '测试店员',
          operatorId: 'OP001'
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('ORDER_ALREADY_VERIFIED');
      expect(response.body.message).toContain('已被核销');
      expect(response.body.data.currentStatus).toBe('completed');
    });

    test('代取人身份证无效应该进入人工审核', async () => {
      const response = await request(app)
        .post('/api/verifications')
        .send({
          orderNo: 'CAKE-20240518-001',
          verificationCode: '123456',
          verificationType: 'proxy',
          proxyPicker: '测试代取人',
          proxyIdCard: 'invalid-id-card',
          proxyPhone: '13800138000',
          balancePaid: 198,
          paymentMethod: 'wechat',
          operator: '测试店员',
          operatorId: 'OP001'
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('PROXY_IDCARD_INVALID');
      expect(response.body.data.status).toBe('manual_review');
    });
  });

  describe('边界情况2：取货日志一致性检查', () => {
    test('正常完成的订单应该日志一致', async () => {
      const response = await request(app).get('/api/verifications/log-consistency/ORD-202405002');
      expect(response.status).toBe(200);
      expect(response.body.data.isConsistent).toBe(true);
    });

    test('撤回后再次提交的订单应该保持日志一致性', async () => {
      await request(app)
        .post('/api/verifications/ORD-202405002/withdraw')
        .send({
          operator: '店长',
          remarks: '客户取消取货'
        });

      const response = await request(app)
        .post('/api/verifications')
        .send({
          orderNo: 'CAKE-20240518-002',
          verificationCode: '654321',
          verificationType: 'customer',
          balancePaid: 98,
          paymentMethod: 'alipay',
          operator: '店员B',
          operatorId: 'OP002'
        });

      const consistencyCheck = await request(app).get('/api/verifications/log-consistency/ORD-202405002');
      expect(consistencyCheck.body.data.isConsistent).toBe(true);
    });
  });

  describe('边界情况3：撤回后再次提交的组合情况', () => {
    test('应该能撤回已完成的订单', async () => {
      const response = await request(app)
        .post('/api/verifications/ORD-202405002/withdraw')
        .send({
          operator: '店长',
          remarks: '客户信息有误，撤回重新核验'
        });

      expect(response.status).toBe(200);
      expect(response.body.code).toBe('SUCCESS');
    });

    test('撤回后应该能再次提交核验', async () => {
      await request(app)
        .post('/api/verifications/ORD-202405002/withdraw')
        .send({
          operator: '店长',
          remarks: '测试撤回'
        });

      const response = await request(app)
        .post('/api/verifications')
        .send({
          orderNo: 'CAKE-20240518-002',
          verificationCode: '654321',
          verificationType: 'customer',
          balancePaid: 98,
          paymentMethod: 'cash',
          operator: '店员B',
          operatorId: 'OP002'
        });

      expect(response.status).toBe(200);
      expect(response.body.code).toBe('SUCCESS');
    });

    test('撤回后修改历史应该有记录', async () => {
      await request(app)
        .post('/api/verifications/ORD-202405002/withdraw')
        .send({
          operator: '店长',
          remarks: '撤回测试'
        });

      const historyResponse = await request(app).get('/api/orders/ORD-202405002/history');
      const withdrawRecords = historyResponse.body.data.filter(h => h.remarks.includes('撤回'));
      expect(withdrawRecords.length).toBeGreaterThan(0);
    });
  });

  describe('人工处理留痕功能', () => {
    test('人工审核备注应该留痕', async () => {
      const response = await request(app)
        .post('/api/verifications/ORD-202405003/resubmit')
        .send({
          operator: '审核员A',
          remarks: '经人工核实，代取人身份有效，予以通过',
          approve: true
        });

      expect(response.status).toBe(200);
      
      const historyResponse = await request(app).get('/api/orders/ORD-202405003/history');
      const manualRecords = historyResponse.body.data.filter(h => h.field === 'manual_remarks');
      expect(manualRecords.length).toBeGreaterThan(0);
    });

    test('人工审核拒绝应该留痕并恢复pending状态', async () => {
      const response = await request(app)
        .post('/api/verifications/ORD-202405003/resubmit')
        .send({
          operator: '审核员B',
          remarks: '代取人授权书缺失，拒绝通过',
          approve: false
        });

      expect(response.status).toBe(200);
      
      const orderResponse = await request(app).get('/api/orders/ORD-202405003');
      expect(orderResponse.body.data.status).toBe('pending');
    });

    test('应该能查看所有核验记录', async () => {
      const response = await request(app).get('/api/verifications');
      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('真实字段验证', () => {
    test('订单应该包含所有蛋糕相关真实字段', async () => {
      const response = await request(app).get('/api/orders/ORD-202405001');
      const order = response.body.data;
      
      expect(order.cakeName).toBeDefined();
      expect(order.cakeSpec).toBeDefined();
      expect(order.pickupTime).toBeDefined();
      expect(order.price).toBeDefined();
      expect(order.deposit).toBeDefined();
      expect(order.balance).toBeDefined();
      expect(order.storeLocation).toBeDefined();
      expect(order.verificationCode).toBeDefined();
    });

    test('核验记录应该包含代取人真实信息', async () => {
      const response = await request(app).get('/api/verifications?orderId=ORD-202405002');
      const verification = response.body.data[0];
      
      expect(verification.proxyPicker).toBeDefined();
      expect(verification.proxyIdCard).toBeDefined();
      expect(verification.proxyPhone).toBeDefined();
      expect(verification.operator).toBeDefined();
    });
  });
});
