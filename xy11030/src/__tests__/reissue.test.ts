import request from 'supertest';
import app from '../index';
import { initDatabase, db } from '../database';
import { CreateReissueOrderRequest, ReissueStatus, IssueType } from '../types';

describe('社区团购仓团购缺件补发系统测试', () => {
  beforeAll(async () => {
    await initDatabase();
  });

  afterAll((done) => {
    db.close(done);
  });

  describe('基础功能测试', () => {
    it('应该能创建补发单', async () => {
      const orderRequest: CreateReissueOrderRequest = {
        groupBuyCode: 'GBTEST001',
        groupBuyName: '测试团购',
        leaderId: 'LDTEST001',
        leaderName: '测试团长',
        leaderPhone: '13800000001',
        warehouseCode: 'WHTEST001',
        warehouseName: '测试仓库',
        originalOrderNo: 'ORDTEST001',
        originalOrderDate: '2024-05-01',
        remark: '测试订单',
        createdBy: 'test',
        items: [
          {
            productCode: 'PRDTEST001',
            productName: '测试商品1',
            skuCode: 'SKUTEST001',
            skuName: '测试规格1',
            issueType: IssueType.MISSING,
            originalQuantity: 10,
            issueQuantity: 2,
            reissueQuantity: 2,
            unitPrice: 29.9,
            remark: '少了2件'
          }
        ]
      };

      const res = await request(app)
        .post('/api/reissues')
        .send(orderRequest);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(ReissueStatus.NORMAL);
      expect(res.body.data.totalAmount).toBe(59.8);
      expect(res.body.data.totalItems).toBe(2);
    });

    it('应该能获取补发单列表', async () => {
      const res = await request(app).get('/api/reissues');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.orders)).toBe(true);
    });

    it('应该能获取补发单详情', async () => {
      const listRes = await request(app).get('/api/reissues');
      const orderId = listRes.body.data.orders[0].id;

      const res = await request(app).get(`/api/reissues/${orderId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order).toBeDefined();
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.history).toBeDefined();
    });

    it('应该能查看修改历史', async () => {
      const listRes = await request(app).get('/api/reissues');
      const orderId = listRes.body.data.orders[0].id;

      const res = await request(app).get(`/api/reissues/${orderId}/history`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('错发缺发混合单测试', () => {
    let mixedOrderId: string;

    it('应该能创建包含错发和缺发的混合补发单', async () => {
      const orderRequest: CreateReissueOrderRequest = {
        groupBuyCode: 'GBMIX001',
        groupBuyName: '混合问题团购',
        leaderId: 'LDMIX001',
        leaderName: '混合测试团长',
        leaderPhone: '13800000002',
        warehouseCode: 'WHMIX001',
        warehouseName: '混合测试仓库',
        originalOrderNo: 'ORDMIX001',
        originalOrderDate: '2024-05-02',
        remark: '混合问题测试订单',
        createdBy: 'test',
        items: [
          {
            productCode: 'PRDMIX001',
            productName: '苹果',
            skuCode: 'SKUMIX001',
            skuName: '5斤装',
            issueType: IssueType.MISSING,
            originalQuantity: 20,
            issueQuantity: 3,
            reissueQuantity: 3,
            unitPrice: 29.9,
            remark: '缺件：少3袋苹果'
          },
          {
            productCode: 'PRDMIX002',
            productName: '香蕉',
            skuCode: 'SKUMIX002',
            skuName: '3斤装',
            issueType: IssueType.WRONG,
            originalQuantity: 10,
            issueQuantity: 2,
            reissueQuantity: 2,
            unitPrice: 19.9,
            remark: '错发：发成了国产香蕉'
          },
          {
            productCode: 'PRDMIX003',
            productName: '橙子',
            skuCode: 'SKUMIX003',
            skuName: '10斤装',
            issueType: IssueType.DAMAGED,
            originalQuantity: 5,
            issueQuantity: 1,
            reissueQuantity: 1,
            unitPrice: 39.9,
            remark: '损坏：包装箱破损'
          }
        ]
      };

      const res = await request(app)
        .post('/api/reissues')
        .send(orderRequest);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      mixedOrderId = res.body.data.id;

      const expectedAmount = (3 * 29.9) + (2 * 19.9) + (1 * 39.9);
      expect(res.body.data.totalAmount).toBeCloseTo(expectedAmount);
      expect(res.body.data.totalItems).toBe(6);
    });

    it('混合单应该能查看所有明细', async () => {
      const res = await request(app).get(`/api/reissues/${mixedOrderId}/items`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);

      const issueTypes = res.body.data.map((item: any) => item.issueType);
      expect(issueTypes).toContain(IssueType.MISSING);
      expect(issueTypes).toContain(IssueType.WRONG);
      expect(issueTypes).toContain(IssueType.DAMAGED);
    });

    it('混合单应该能完整流转', async () => {
      await request(app)
        .put(`/api/reissues/${mixedOrderId}/status`)
        .send({
          status: ReissueStatus.PROCESSING,
          operatorId: 'op001',
          operatorName: '操作员',
          remark: '开始处理混合单'
        });

      await request(app)
        .put(`/api/reissues/${mixedOrderId}/status`)
        .send({
          status: ReissueStatus.REVIEWING,
          operatorId: 'op001',
          operatorName: '操作员',
          remark: '提交复核'
        });

      const res = await request(app)
        .put(`/api/reissues/${mixedOrderId}/status`)
        .send({
          status: ReissueStatus.COMPLETED,
          operatorId: 'mgr001',
          operatorName: '经理',
          remark: '复核通过，补发完成'
        });

      expect(res.body.data.status).toBe(ReissueStatus.COMPLETED);

      const historyRes = await request(app).get(`/api/reissues/${mixedOrderId}/history`);
      const actions = historyRes.body.data.map((h: any) => h.action);
      expect(actions).toContain('开始处理');
      expect(actions).toContain('提交复核');
      expect(actions).toContain('完成');
    });
  });

  describe('补发统计一致性测试', () => {
    it('统计数据应该与实际订单数一致', async () => {
      const listRes = await request(app).get('/api/reissues?pageSize=100');
      const totalOrders = listRes.body.data.total;

      const statsRes = await request(app).get('/api/reissues/statistics');
      expect(statsRes.status).toBe(200);
      expect(statsRes.body.data.totalOrders).toBe(totalOrders);

      const statusCounts = statsRes.body.data.statusCounts;
      let sum = 0;
      for (const key in statusCounts) {
        sum += statusCounts[key];
      }
      expect(sum).toBe(totalOrders);
    });

    it('按状态筛选的结果应该与统计一致', async () => {
      const statsRes = await request(app).get('/api/reissues/statistics');
      const completedCount = statsRes.body.data.statusCounts.completed;

      const listRes = await request(app).get('/api/reissues?status=completed');
      expect(listRes.body.data.orders.length).toBe(completedCount);
    });

    it('统计金额应该与订单总金额匹配', async () => {
      const listRes = await request(app).get('/api/reissues?pageSize=100');
      const calculatedTotal = listRes.body.data.orders.reduce(
        (sum: number, order: any) => sum + order.totalAmount,
        0
      );

      const statsRes = await request(app).get('/api/reissues/statistics');
      expect(statsRes.body.data.totalAmount).toBeCloseTo(calculatedTotal, 0);
    });
  });

  describe('撤回后再次提交测试', () => {
    let testOrderId: string;

    it('应该能创建并驳回订单', async () => {
      const orderRequest: CreateReissueOrderRequest = {
        groupBuyCode: 'GBRESUB001',
        groupBuyName: '重提测试团购',
        leaderId: 'LDRESUB001',
        leaderName: '重提测试团长',
        leaderPhone: '13800000003',
        warehouseCode: 'WHRESUB001',
        warehouseName: '重提测试仓库',
        originalOrderNo: 'ORDRESUB001',
        originalOrderDate: '2024-05-03',
        remark: '重提测试订单',
        createdBy: 'test',
        items: [
          {
            productCode: 'PRDRESUB001',
            productName: '测试商品',
            skuCode: 'SKURESUB001',
            skuName: '测试规格',
            issueType: IssueType.MISSING,
            originalQuantity: 5,
            issueQuantity: 1,
            reissueQuantity: 1,
            unitPrice: 50,
            remark: '少了1件'
          }
        ]
      };

      const createRes = await request(app)
        .post('/api/reissues')
        .send(orderRequest);

      testOrderId = createRes.body.data.id;

      const rejectRes = await request(app)
        .put(`/api/reissues/${testOrderId}/status`)
        .send({
          status: ReissueStatus.REJECTED,
          operatorId: 'mgr001',
          operatorName: '经理',
          remark: '驳回：需要补充凭证'
        });

      expect(rejectRes.body.data.status).toBe(ReissueStatus.REJECTED);
    });

    it('驳回的订单应该能重新提交', async () => {
      const historyBeforeRes = await request(app).get(`/api/reissues/${testOrderId}/history`);
      const historyCountBefore = historyBeforeRes.body.data.length;

      const resubmitRes = await request(app)
        .post(`/api/reissues/${testOrderId}/resubmit`)
        .send({
          operatorId: 'op001',
          operatorName: '操作员',
          remark: '已补充凭证，重新提交'
        });

      expect(resubmitRes.status).toBe(200);
      expect(resubmitRes.body.data.status).toBe(ReissueStatus.PROCESSING);

      const historyAfterRes = await request(app).get(`/api/reissues/${testOrderId}/history`);
      expect(historyAfterRes.body.data.length).toBe(historyCountBefore + 1);

      const latestHistory = historyAfterRes.body.data[0];
      expect(latestHistory.previousStatus).toBe(ReissueStatus.REJECTED);
      expect(latestHistory.newStatus).toBe(ReissueStatus.PROCESSING);
    });

    it('重新提交后应该能正常完成流程', async () => {
      await request(app)
        .put(`/api/reissues/${testOrderId}/status`)
        .send({
          status: ReissueStatus.REVIEWING,
          operatorId: 'op001',
          operatorName: '操作员',
          remark: '处理完成，提交复核'
        });

      const completeRes = await request(app)
        .put(`/api/reissues/${testOrderId}/status`)
        .send({
          status: ReissueStatus.COMPLETED,
          operatorId: 'mgr001',
          operatorName: '经理',
          remark: '复核通过，补发完成'
        });

      expect(completeRes.body.data.status).toBe(ReissueStatus.COMPLETED);

      const historyRes = await request(app).get(`/api/reissues/${testOrderId}/history`);
      const actions = historyRes.body.data.map((h: any) => h.action);

      expect(actions).toContain('驳回');
      expect(actions).toContain('开始处理');
      expect(actions).toContain('提交复核');
      expect(actions).toContain('完成');
    });

    it('人工处理备注应该完整记录', async () => {
      const historyRes = await request(app).get(`/api/reissues/${testOrderId}/history`);
      const history = historyRes.body.data;

      const rejectRecord = history.find((h: any) => h.action === '驳回');
      expect(rejectRecord).toBeDefined();
      expect(rejectRecord.remark).toContain('需要补充凭证');

      const resubmitRecord = history.find((h: any) => h.action === '开始处理' && h.previousStatus === 'rejected');
      expect(resubmitRecord).toBeDefined();

      const completeRecord = history.find((h: any) => h.action === '完成');
      expect(completeRecord).toBeDefined();
      expect(completeRecord.remark).toContain('复核通过');
    });
  });

  describe('状态流转测试', () => {
    let orderId: string;

    beforeAll(async () => {
      const orderRequest: CreateReissueOrderRequest = {
        groupBuyCode: 'GBFLOW001',
        groupBuyName: '流转测试团购',
        leaderId: 'LDFLOW001',
        leaderName: '流转测试团长',
        leaderPhone: '13800000004',
        warehouseCode: 'WHFLOW001',
        warehouseName: '流转测试仓库',
        originalOrderNo: 'ORDFLOW001',
        originalOrderDate: '2024-05-04',
        remark: '流转测试订单',
        createdBy: 'test',
        items: [
          {
            productCode: 'PRDFLOW001',
            productName: '测试商品',
            skuCode: 'SKUFLOW001',
            skuName: '测试规格',
            issueType: IssueType.MISSING,
            originalQuantity: 10,
            issueQuantity: 1,
            reissueQuantity: 1,
            unitPrice: 100,
            remark: '测试'
          }
        ]
      };

      const res = await request(app)
        .post('/api/reissues')
        .send(orderRequest);
      orderId = res.body.data.id;
    });

    it('应该能正常流转所有状态', async () => {
      const statusFlow = [
        { status: ReissueStatus.PROCESSING, action: '开始处理' },
        { status: ReissueStatus.SUPPLEMENTED, action: '补录信息' },
        { status: ReissueStatus.REVIEWING, action: '提交复核' },
        { status: ReissueStatus.COMPLETED, action: '完成' }
      ];

      for (const flow of statusFlow) {
        const res = await request(app)
          .put(`/api/reissues/${orderId}/status`)
          .send({
            status: flow.status,
            operatorId: 'op001',
            operatorName: '操作员',
            remark: `${flow.action}备注`
          });
        expect(res.body.data.status).toBe(flow.status);
      }

      const historyRes = await request(app).get(`/api/reissues/${orderId}/history`);
      const actions = historyRes.body.data.map((h: any) => h.action);

      for (const flow of statusFlow) {
        expect(actions).toContain(flow.action);
      }
    });
  });
});
