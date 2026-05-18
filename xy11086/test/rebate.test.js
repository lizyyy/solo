const request = require('supertest');
const app = require('../src/app');
const db = require('../src/database');

describe('酒类经销商酒水返利核算 API 测试', () => {
  let testOrderId;

  beforeAll((done) => {
    db.serialize(() => {
      db.run('DELETE FROM return_adjustments');
      db.run('DELETE FROM modification_history');
      db.run('DELETE FROM rebate_details');
      db.run('DELETE FROM rebate_orders', done);
    });
  });

  afterAll((done) => {
    db.close(done);
  });

  describe('1. 基础功能测试', () => {
    test('创建返利核算单 - 真实酒水经销商数据', async () => {
      const response = await request(app)
        .post('/api/rebate')
        .send({
          dealerCode: 'DLJ001',
          dealerName: '北京鑫源酒业有限公司',
          orderNo: 'FL202405001',
          orderDate: '2024-05-15',
          settlementPeriod: '2024-Q2',
          rebateRate: 0.05,
          handler: '张三',
          remark: '第二季度常规返利',
          details: [
            {
              productCode: 'W001',
              productName: '53度飞天茅台500ml',
              quantity: 100,
              unitPrice: 1499,
              rebateRate: 0.05
            },
            {
              productCode: 'W002',
              productName: '52度五粮液500ml',
              quantity: 200,
              unitPrice: 1099,
              rebateRate: 0.05
            },
            {
              productCode: 'W003',
              productName: '42度洋河蓝色经典500ml',
              quantity: 150,
              unitPrice: 358,
              rebateRate: 0.05
            }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body.orderNo).toBe('FL202405001');
      testOrderId = response.body.id;
    });

    test('查询返利核算单列表', async () => {
      const response = await request(app)
        .get('/api/rebate?dealerCode=DLJ001');
      
      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].dealerName).toBe('北京鑫源酒业有限公司');
    });

    test('查询返利核算单详情 - 包含明细和历史记录', async () => {
      const response = await request(app)
        .get(`/api/rebate/${testOrderId}`);
      
      expect(response.status).toBe(200);
      expect(response.body.order.orderNo).toBe('FL202405001');
      expect(response.body.details.length).toBe(3);
      expect(response.body.history.length).toBeGreaterThan(0);
      expect(response.body.details[0].productName).toBe('53度飞天茅台500ml');
    });
  });

  describe('2. 返利明细一致性校验测试', () => {
    let inconsistentOrderId;

    test('先创建一个正常的返利单', async () => {
      const response = await request(app)
        .post('/api/rebate')
        .send({
          dealerCode: 'DLJ002',
          dealerName: '上海酒都贸易有限公司',
          orderNo: 'FL202405002',
          orderDate: '2024-05-16',
          settlementPeriod: '2024-Q2',
          rebateRate: 0.04,
          handler: '李四',
          details: [
            {
              productCode: 'W004',
              productName: '泸州老窖特曲500ml',
              quantity: 100,
              unitPrice: 288,
              rebateRate: 0.04
            }
          ]
        });
      inconsistentOrderId = response.body.id;
    });

    test('提交时校验返利明细一致性 - 明细合计与总金额一致时通过', async () => {
      const response = await request(app)
        .post(`/api/rebate/${inconsistentOrderId}/submit`)
        .send({
          operator: '李四'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('PENDING');
    });

    test('手工构造数据不一致场景并校验', async () => {
      await new Promise((resolve) => {
        db.run('UPDATE rebate_orders SET rebate_amount = rebate_amount + 1000 WHERE id = ?', [inconsistentOrderId], resolve);
      });

      const checkResponse = await request(app)
        .get(`/api/rebate/${inconsistentOrderId}/check-deduction`);
      
      expect(checkResponse.status).toBe(200);
      expect(checkResponse.body.hasIssues).toBe(true);
      expect(checkResponse.body.issues.some(i => i.type === 'REBATE_AMOUNT_MISMATCH')).toBe(true);
    });
  });

  describe('3. 退货冲减与返利基数重算测试', () => {
    let returnTestOrderId;

    test('创建待退货测试返利单', async () => {
      const response = await request(app)
        .post('/api/rebate')
        .send({
          dealerCode: 'DLJ003',
          dealerName: '广州美酒汇商贸有限公司',
          orderNo: 'FL202405003',
          orderDate: '2024-05-17',
          settlementPeriod: '2024-Q2',
          rebateRate: 0.06,
          handler: '王五',
          details: [
            {
              productCode: 'W005',
              productName: '剑南春水晶剑500ml',
              quantity: 50,
              unitPrice: 458,
              rebateRate: 0.06
            }
          ]
        });
      returnTestOrderId = response.body.id;
    });

    test('正常退货冲减 - 扣减返利基数', async () => {
      const detailResponse = await request(app)
        .get(`/api/rebate/${returnTestOrderId}`);
      const initialBase = detailResponse.body.order.actualRebateBase;

      const response = await request(app)
        .post(`/api/rebate/${returnTestOrderId}/return-adjustment`)
        .send({
          returnOrderNo: 'TH202405001',
          returnDate: '2024-05-18',
          productCode: 'W005',
          productName: '剑南春水晶剑500ml',
          returnQuantity: 10,
          returnAmount: 4580,
          operator: '王五'
        });

      expect(response.status).toBe(200);
      expect(response.body.isPostPayment).toBe(false);

      const afterAdjustment = await request(app)
        .get(`/api/rebate/${returnTestOrderId}`);
      
      expect(afterAdjustment.body.order.returnAmount).toBe(4580);
      expect(afterAdjustment.body.order.actualRebateBase).toBe(initialBase - 4580);
      expect(afterAdjustment.body.adjustments.length).toBe(1);
    });

    test('检查退货扣减完整性 - 无未扣减退货', async () => {
      const response = await request(app)
        .get(`/api/rebate/${returnTestOrderId}/check-deduction`);
      
      expect(response.status).toBe(200);
      expect(response.body.hasIssues).toBe(false);
    });

    test('模拟退货单未扣减场景并检测', async () => {
      await new Promise((resolve) => {
        db.run('UPDATE rebate_orders SET actual_rebate_base = actual_rebate_base + 4580 WHERE id = ?', [returnTestOrderId], resolve);
      });

      const response = await request(app)
        .get(`/api/rebate/${returnTestOrderId}/check-deduction`);
      
      expect(response.status).toBe(200);
      expect(response.body.hasIssues).toBe(true);
      expect(response.body.issues.some(i => i.type === 'RETURN_DEDUCTION_MISSING')).toBe(true);
    });
  });

  describe('4. 已打款后冲正记录测试', () => {
    let paidOrderId;

    test('创建测试返利单并标记已打款', async () => {
      const response = await request(app)
        .post('/api/rebate')
        .send({
          dealerCode: 'DLJ004',
          dealerName: '深圳名酒城有限公司',
          orderNo: 'FL202405004',
          orderDate: '2024-05-19',
          settlementPeriod: '2024-Q2',
          rebateRate: 0.055,
          handler: '赵六',
          details: [
            {
              productCode: 'W006',
              productName: '汾酒青花20年500ml',
              quantity: 80,
              unitPrice: 398,
              rebateRate: 0.055
            }
          ]
        });
      paidOrderId = response.body.id;

      await new Promise((resolve) => {
        db.run('UPDATE rebate_orders SET paid_amount = 1000 WHERE id = ?', [paidOrderId], resolve);
      });
    });

    test('已打款后退货 - 生成冲正记录', async () => {
      const response = await request(app)
        .post(`/api/rebate/${paidOrderId}/return-adjustment`)
        .send({
          returnOrderNo: 'TH202405002',
          returnDate: '2024-05-20',
          productCode: 'W006',
          productName: '汾酒青花20年500ml',
          returnQuantity: 5,
          returnAmount: 1990,
          operator: '赵六'
        });

      expect(response.status).toBe(200);
      expect(response.body.isPostPayment).toBe(true);
      expect(response.body.correctionRecord).toContain('已打款后冲正');

      const detailResponse = await request(app)
        .get(`/api/rebate/${paidOrderId}`);
      expect(detailResponse.body.adjustments[0].isPostPayment).toBe(true);
      expect(detailResponse.body.adjustments[0].correctionRecord).not.toBeNull();
    });
  });

  describe('5. 撤回后再次提交组合场景测试', () => {
    let revokeTestOrderId;

    test('创建并提交返利单', async () => {
      const response = await request(app)
        .post('/api/rebate')
        .send({
          dealerCode: 'DLJ005',
          dealerName: '成都酒香天下商贸有限公司',
          orderNo: 'FL202405005',
          orderDate: '2024-05-21',
          settlementPeriod: '2024-Q2',
          rebateRate: 0.045,
          handler: '孙七',
          details: [
            {
              productCode: 'W007',
              productName: '水井坊臻酿八号500ml',
              quantity: 120,
              unitPrice: 328,
              rebateRate: 0.045
            }
          ]
        });
      revokeTestOrderId = response.body.id;

      const submitResponse = await request(app)
        .post(`/api/rebate/${revokeTestOrderId}/submit`)
        .send({ operator: '孙七' });
      expect(submitResponse.status).toBe(200);
    });

    test('撤回返利单 - 留痕记录', async () => {
      const response = await request(app)
        .post(`/api/rebate/${revokeTestOrderId}/revoke`)
        .send({
          operator: '财务主管',
          reason: '明细有误，需要调整后重新提交'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('REVOKED');

      const detailResponse = await request(app)
        .get(`/api/rebate/${revokeTestOrderId}`);
      const revokeHistory = detailResponse.body.history.find(h => h.operationType === 'REVOKE');
      expect(revokeHistory).toBeDefined();
      expect(revokeHistory.remark).toBe('明细有误，需要调整后重新提交');
      expect(revokeHistory.oldStatus).toBe('PENDING');
      expect(revokeHistory.newStatus).toBe('REVOKED');
    });

    test('撤回后再次提交', async () => {
      const response = await request(app)
        .post(`/api/rebate/${revokeTestOrderId}/submit`)
        .send({
          operator: '孙七',
          remark: '已调整明细，重新提交'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('PENDING');

      const detailResponse = await request(app)
        .get(`/api/rebate/${revokeTestOrderId}`);
      const submitHistory = detailResponse.body.history.find(h => 
        h.operationType === 'SUBMIT' && h.oldStatus === 'REVOKED'
      );
      expect(submitHistory).toBeDefined();
      expect(submitHistory.remark).toBe('已调整明细，重新提交');
    });
  });

  describe('6. 人工处理流程与备注留痕测试', () => {
    let manualOrderId;

    test('创建并提交待审核返利单', async () => {
      const response = await request(app)
        .post('/api/rebate')
        .send({
          dealerCode: 'DLJ006',
          dealerName: '杭州西湖酒业有限公司',
          orderNo: 'FL202405006',
          orderDate: '2024-05-22',
          settlementPeriod: '2024-Q2',
          rebateRate: 0.05,
          handler: '周八',
          details: [
            {
              productCode: 'W008',
              productName: '古越龙山花雕酒500ml',
              quantity: 200,
              unitPrice: 68,
              rebateRate: 0.05
            }
          ]
        });
      manualOrderId = response.body.id;

      await request(app)
        .post(`/api/rebate/${manualOrderId}/submit`)
        .send({ operator: '周八' });
    });

    test('添加人工处理备注 - 仅记录不改变状态', async () => {
      const response = await request(app)
        .post(`/api/rebate/${manualOrderId}/manual`)
        .send({
          operator: '审核员A',
          action: 'REMARK',
          remark: '该经销商本季度表现优秀，建议额外增加1%返利比例'
        });

      expect(response.status).toBe(200);

      const detailResponse = await request(app)
        .get(`/api/rebate/${manualOrderId}`);
      const remarkHistory = detailResponse.body.history.find(h => 
        h.operationType === 'MANUAL_PROCESS' && h.changeContent === '添加人工处理备注'
      );
      expect(remarkHistory).toBeDefined();
      expect(remarkHistory.remark).toContain('额外增加1%返利比例');
      expect(remarkHistory.oldStatus).toBe(remarkHistory.newStatus);
    });

    test('人工审核通过 - 状态变更留痕', async () => {
      const response = await request(app)
        .post(`/api/rebate/${manualOrderId}/manual`)
        .send({
          operator: '审核经理',
          action: 'APPROVE',
          remark: '同意额外增加1%返利，最终按6%结算'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('APPROVED');

      const detailResponse = await request(app)
        .get(`/api/rebate/${manualOrderId}`);
      const approveHistory = detailResponse.body.history.find(h => 
        h.operationType === 'MANUAL_PROCESS' && h.changeContent === '人工审核通过'
      );
      expect(approveHistory).toBeDefined();
      expect(approveHistory.oldStatus).toBe('PENDING');
      expect(approveHistory.newStatus).toBe('APPROVED');
    });
  });

  describe('7. 错误响应测试 - 清晰的中文提示', () => {
    test('返利单不存在 - 清晰错误信息', async () => {
      const response = await request(app)
        .get('/api/rebate/invalid-id-12345');
      
      expect(response.status).toBe(404);
      expect(response.body.error).toContain('不存在');
      expect(response.body.code).toBe('ORDER_NOT_FOUND');
    });

    test('重复单号 - 清晰错误信息', async () => {
      const response = await request(app)
        .post('/api/rebate')
        .send({
          dealerCode: 'DLJ999',
          dealerName: '测试经销商',
          orderNo: 'FL202405001',
          orderDate: '2024-05-15',
          settlementPeriod: '2024-Q2',
          rebateRate: 0.05,
          details: [
            {
              productCode: 'TEST',
              productName: '测试商品',
              quantity: 10,
              unitPrice: 100,
              rebateRate: 0.05
            }
          ]
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('已存在');
      expect(response.body.code).toBe('DUPLICATE_ORDER_NO');
    });

    test('必填字段缺失 - 中文错误提示', async () => {
      const response = await request(app)
        .post('/api/rebate')
        .send({
          dealerCode: 'DLJ999',
          orderNo: 'FL202499999'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    test('状态不允许撤回 - 清晰错误信息', async () => {
      const response = await request(app)
        .post(`/api/rebate/${testOrderId}/revoke`)
        .send({
          operator: '测试员',
          reason: '测试撤回'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('不允许撤回');
      expect(response.body.code).toBe('INVALID_STATUS');
    });
  });

  describe('8. 完整流程组合场景测试', () => {
    test('完整业务流程：创建 -> 退货冲减 -> 提交 -> 撤回 -> 修改 -> 再提交 -> 人工审核 -> 打款后退货冲正', async () => {
      let orderId;

      const createResponse = await request(app)
        .post('/api/rebate')
        .send({
          dealerCode: 'DLJ007',
          dealerName: '南京金陵酒业有限公司',
          orderNo: 'FL202405007',
          orderDate: '2024-05-25',
          settlementPeriod: '2024-Q2',
          rebateRate: 0.05,
          handler: '吴九',
          remark: '第二季度返利',
          details: [
            { productCode: 'J001', productName: '今世缘国缘四开500ml', quantity: 100, unitPrice: 488, rebateRate: 0.05 },
            { productCode: 'J002', productName: '洋河天之蓝500ml', quantity: 150, unitPrice: 398, rebateRate: 0.05 }
          ]
        });
      orderId = createResponse.body.id;
      expect(createResponse.status).toBe(201);

      const return1Response = await request(app)
        .post(`/api/rebate/${orderId}/return-adjustment`)
        .send({
          returnOrderNo: 'TH202405010',
          returnDate: '2024-05-26',
          productCode: 'J001',
          productName: '今世缘国缘四开500ml',
          returnQuantity: 5,
          returnAmount: 2440,
          operator: '吴九'
        });
      expect(return1Response.status).toBe(200);
      expect(return1Response.body.isPostPayment).toBe(false);

      const submit1Response = await request(app)
        .post(`/api/rebate/${orderId}/submit`)
        .send({ operator: '吴九', remark: '第一次提交' });
      expect(submit1Response.status).toBe(200);

      const revokeResponse = await request(app)
        .post(`/api/rebate/${orderId}/revoke`)
        .send({ operator: '财务主管', reason: '发现还有退货未录入，需补充后再提交' });
      expect(revokeResponse.status).toBe(200);

      const return2Response = await request(app)
        .post(`/api/rebate/${orderId}/return-adjustment`)
        .send({
          returnOrderNo: 'TH202405011',
          returnDate: '2024-05-27',
          productCode: 'J002',
          productName: '洋河天之蓝500ml',
          returnQuantity: 10,
          returnAmount: 3980,
          operator: '吴九'
        });
      expect(return2Response.status).toBe(200);

      const submit2Response = await request(app)
        .post(`/api/rebate/${orderId}/submit`)
        .send({ operator: '吴九', remark: '补充退货后重新提交' });
      expect(submit2Response.status).toBe(200);

      const manualResponse = await request(app)
        .post(`/api/rebate/${orderId}/manual`)
        .send({ operator: '财务经理', action: 'APPROVE', remark: '审核通过，同意本次返利申请' });
      expect(manualResponse.status).toBe(200);
      expect(manualResponse.body.status).toBe('APPROVED');

      await new Promise((resolve) => {
        db.run('UPDATE rebate_orders SET paid_amount = rebate_amount WHERE id = ?', [orderId], resolve);
      });

      const return3Response = await request(app)
        .post(`/api/rebate/${orderId}/return-adjustment`)
        .send({
          returnOrderNo: 'TH202405012',
          returnDate: '2024-05-28',
          productCode: 'J001',
          productName: '今世缘国缘四开500ml',
          returnQuantity: 3,
          returnAmount: 1464,
          operator: '财务出纳'
        });
      expect(return3Response.status).toBe(200);
      expect(return3Response.body.isPostPayment).toBe(true);
      expect(return3Response.body.correctionRecord).toBeDefined();

      const finalDetail = await request(app)
        .get(`/api/rebate/${orderId}`);
      
      expect(finalDetail.body.history.length).toBeGreaterThanOrEqual(6);
      expect(finalDetail.body.adjustments.length).toBe(3);
      expect(finalDetail.body.adjustments.filter(a => a.isPostPayment).length).toBe(1);
    });
  });
});
