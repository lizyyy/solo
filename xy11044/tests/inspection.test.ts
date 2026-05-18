import * as inspectionService from '../src/services/inspectionService';
import * as calculationService from '../src/services/calculationService';
import { db } from '../src/database';
import { CreateOrderRequest } from '../src/types';

describe('水产批发档口海鲜到货验收API测试', () => {
  beforeAll((done) => {
    setTimeout(() => {
      db.serialize(() => {
        db.run('DELETE FROM inspection_history');
        db.run('DELETE FROM inspection_items');
        db.run('DELETE FROM inspection_orders', done);
      });
    }, 100);
  });

  afterAll((done) => {
    db.close(done);
  });

  const TEST_DATE = '2024-01-15';

  describe('损耗计算测试', () => {
    it('应该正确计算单品损耗重量和损耗率', () => {
      const result = calculationService.calculateItemLoss({
        expectedWeight: 100,
        actualWeight: 95
      });
      expect(result.lossWeight).toBe(5);
      expect(result.lossRate).toBe(5.00);
    });

    it('应该正确处理零损耗情况', () => {
      const result = calculationService.calculateItemLoss({
        expectedWeight: 100,
        actualWeight: 100
      });
      expect(result.lossWeight).toBe(0);
      expect(result.lossRate).toBe(0);
    });

    it('应该正确处理实际重量大于预期重量的情况（不出现负损耗）', () => {
      const result = calculationService.calculateItemLoss({
        expectedWeight: 100,
        actualWeight: 105
      });
      expect(result.lossWeight).toBe(0);
      expect(result.lossRate).toBe(0);
    });
  });

  describe('冰鲜和活鲜混批影响损耗测试', () => {
    let orderId: string;

    it('应该创建包含冰鲜和活鲜的混批验收单并正确计算汇总损耗', async () => {
      const request: CreateOrderRequest = {
        supplierId: 'SUP001',
        supplierName: '东海水产批发',
        deliveryDate: TEST_DATE,
        vehicleNo: '浙B12345',
        driverName: '张师傅',
        driverPhone: '13800138000',
        items: [
          {
            seafoodType: 'fish',
            seafoodName: '大黄鱼',
            seafoodSpec: '300-400g/条',
            isLive: 1,
            expectedQuantity: 50,
            expectedWeight: 17.5,
            actualQuantity: 48,
            actualWeight: 16.2,
            temperature: 8,
            salinity: 28,
            phValue: 7.8,
            qualityLevel: 'good',
            abnormalDescription: '2条死亡已剔除',
            imageUrls: '["http://example.com/img1.jpg"]',
            remark: '活鲜运输正常'
          },
          {
            seafoodType: 'shrimp',
            seafoodName: '基围虾',
            seafoodSpec: '40-50尾/斤',
            isLive: 1,
            expectedQuantity: 200,
            expectedWeight: 20,
            actualQuantity: 190,
            actualWeight: 18.5,
            temperature: 10,
            salinity: 30,
            phValue: 8.0,
            qualityLevel: 'normal',
            abnormalDescription: '部分活力不足',
            remark: '活鲜'
          },
          {
            seafoodType: 'fish',
            seafoodName: '带鱼',
            seafoodSpec: '500-700g/条',
            isLive: 0,
            expectedQuantity: 30,
            expectedWeight: 18,
            actualQuantity: 30,
            actualWeight: 17.5,
            temperature: -2,
            qualityLevel: 'good',
            remark: '冰鲜，冷链正常'
          },
          {
            seafoodType: 'crab',
            seafoodName: '梭子蟹',
            seafoodSpec: '200-300g/只',
            isLive: 0,
            expectedQuantity: 100,
            expectedWeight: 25,
            actualQuantity: 98,
            actualWeight: 24.2,
            temperature: 0,
            qualityLevel: 'good',
            abnormalDescription: '2只不新鲜已退回',
            remark: '冰鲜'
          }
        ],
        operatorId: 'OP001',
        operatorName: '验收员小李'
      };

      const order = await inspectionService.createOrder(request);
      orderId = order.id;

      expect(order.orderNo).toBeDefined();
      expect(order.totalQuantity).toBe(380);
      expect(order.totalWeight).toBeCloseTo(76.4, 1);
      expect(order.totalLossWeight).toBeGreaterThan(0);
      expect(order.status).toBe('draft');

      const orderWithItems = await inspectionService.getOrderWithItems(orderId);
      expect(orderWithItems).toBeDefined();
      expect(orderWithItems!.items.length).toBe(4);

      const liveItems = orderWithItems!.items.filter(i => i.isLive === 1);
      const icedItems = orderWithItems!.items.filter(i => i.isLive === 0);

      expect(liveItems.length).toBe(2);
      expect(icedItems.length).toBe(2);

      const liveLossWeight = liveItems.reduce((sum, i) => sum + i.lossWeight, 0);
      const icedLossWeight = icedItems.reduce((sum, i) => sum + i.lossWeight, 0);
      
      expect(liveLossWeight).toBeGreaterThan(icedLossWeight);
    });

    it('应该从列表进入详情页查看完整信息', async () => {
      const { orders, total } = await inspectionService.getOrderList(1, 10, undefined, TEST_DATE, TEST_DATE);
      expect(total).toBeGreaterThan(0);
      expect(orders.length).toBeGreaterThan(0);

      const firstOrder = orders[0];
      const orderDetail = await inspectionService.getOrderWithItems(firstOrder.id);
      
      expect(orderDetail).toBeDefined();
      expect(orderDetail!.order.id).toBe(firstOrder.id);
      expect(orderDetail!.items.length).toBeGreaterThan(0);
    });

    it('应该能看到每次修改的历史记录', async () => {
      const history = await inspectionService.getOrderHistory(orderId);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].operationType).toBe('create');
      expect(history[0].changeContent).toContain('创建验收单');
    });
  });

  describe('撤回后再次提交测试', () => {
    let orderId: string;

    it('应该创建草稿验收单', async () => {
      const request: CreateOrderRequest = {
        supplierId: 'SUP002',
        supplierName: '南海渔业',
        deliveryDate: TEST_DATE,
        items: [
          {
            seafoodType: 'shellfish',
            seafoodName: '生蚝',
            seafoodSpec: '100-150g/个',
            isLive: 1,
            expectedQuantity: 200,
            expectedWeight: 25,
            actualQuantity: 195,
            actualWeight: 24,
            qualityLevel: 'good'
          }
        ],
        operatorId: 'OP002',
        operatorName: '验收员小王'
      };

      const order = await inspectionService.createOrder(request);
      orderId = order.id;
      expect(order.status).toBe('draft');
    });

    it('应该成功提交验收单', async () => {
      const order = await inspectionService.submitOrder(orderId, {
        operatorId: 'OP002',
        operatorName: '验收员小王',
        remark: '首次提交'
      });
      expect(order.status).toBe('submitted');
    });

    it('应该能看到提交的历史记录', async () => {
      const history = await inspectionService.getOrderHistory(orderId);
      const submitRecord = history.find(h => h.operationType === 'submit');
      expect(submitRecord).toBeDefined();
      expect(submitRecord!.beforeStatus).toBe('draft');
      expect(submitRecord!.afterStatus).toBe('submitted');
    });

    it('应该能撤回已提交的验收单', async () => {
      const order = await inspectionService.withdrawOrder(orderId, {
        operatorId: 'OP002',
        operatorName: '验收员小王',
        remark: '发现数据有误，撤回修改'
      });
      expect(order.status).toBe('withdrawn');
    });

    it('应该能看到撤回的历史记录', async () => {
      const history = await inspectionService.getOrderHistory(orderId);
      const withdrawRecord = history.find(h => h.operationType === 'withdraw');
      expect(withdrawRecord).toBeDefined();
      expect(withdrawRecord!.beforeStatus).toBe('submitted');
      expect(withdrawRecord!.afterStatus).toBe('withdrawn');
    });

    it('应该能修改已撤回的验收单', async () => {
      const order = await inspectionService.updateOrder(orderId, {
        items: [
          {
            seafoodType: 'shellfish',
            seafoodName: '生蚝',
            seafoodSpec: '100-150g/个',
            isLive: 1,
            expectedQuantity: 200,
            expectedWeight: 25,
            actualQuantity: 198,
            actualWeight: 24.5,
            qualityLevel: 'excellent'
          }
        ],
        remark: '修正实际收货数量',
        operatorId: 'OP002',
        operatorName: '验收员小王'
      });
      expect(order.status).toBe('withdrawn');
      expect(order.totalWeight).toBeCloseTo(24.5, 1);
    });

    it('应该能再次提交已修改的验收单', async () => {
      const order = await inspectionService.submitOrder(orderId, {
        operatorId: 'OP002',
        operatorName: '验收员小王',
        remark: '修正后再次提交'
      });
      expect(order.status).toBe('submitted');
    });

    it('应该能看到完整的操作历史链条', async () => {
      const history = await inspectionService.getOrderHistory(orderId);
      const operationTypes = history.map(h => h.operationType);
      
      expect(operationTypes).toContain('create');
      expect(operationTypes).toContain('submit');
      expect(operationTypes).toContain('withdraw');
      expect(operationTypes).toContain('update');
      expect(operationTypes.filter(t => t === 'submit').length).toBe(2);
    });
  });

  describe('人工处理流程测试', () => {
    let orderId: string;

    it('应该创建并提交验收单', async () => {
      const request: CreateOrderRequest = {
        supplierId: 'SUP003',
        supplierName: '黄海水产',
        deliveryDate: TEST_DATE,
        items: [
          {
            seafoodType: 'squid',
            seafoodName: '鱿鱼',
            seafoodSpec: '200-300g/条',
            isLive: 0,
            expectedQuantity: 100,
            expectedWeight: 25,
            actualQuantity: 95,
            actualWeight: 23.5,
            qualityLevel: 'poor',
            abnormalDescription: '部分解冻过度，品质较差'
          }
        ],
        operatorId: 'OP003',
        operatorName: '验收员小张'
      };

      const order = await inspectionService.createOrder(request);
      orderId = order.id;
      await inspectionService.submitOrder(orderId, { operatorId: 'OP003' });
    });

    it('应该能进入人工处理流程', async () => {
      const order = await inspectionService.startManualProcess(orderId, {
        operatorId: 'MANAGER001',
        operatorName: '部门经理',
        remark: '品质异常，进入人工审核流程'
      });
      expect(order.status).toBe('manual_processing');
    });

    it('应该能在人工处理状态添加备注留痕', async () => {
      await inspectionService.addRemark(orderId, {
        operatorId: 'MANAGER001',
        operatorName: '部门经理',
        remark: '已联系供应商确认情况，等待回复'
      });

      await inspectionService.addRemark(orderId, {
        operatorId: 'MANAGER001',
        operatorName: '部门经理',
        remark: '供应商确认赔偿20%货款'
      });

      const history = await inspectionService.getOrderHistory(orderId);
      const remarkRecords = history.filter(h => h.operationType === 'add_remark');
      expect(remarkRecords.length).toBe(2);
    });

    it('应该能审批通过人工处理的验收单', async () => {
      const order = await inspectionService.approveOrder(
        orderId,
        'MANAGER001',
        '部门经理',
        '同意按异常处理，扣款20%'
      );
      expect(order.status).toBe('approved');
    });

    it('应该能看到完整的人工处理历史链条', async () => {
      const history = await inspectionService.getOrderHistory(orderId);
      const operationTypes = history.map(h => h.operationType);
      
      expect(operationTypes).toContain('manual_process');
      expect(operationTypes).toContain('add_remark');
      expect(operationTypes).toContain('approve');
    });
  });

  describe('日报一致性和同一计算口径测试', () => {
    it('应该正确计算日报汇总数据', async () => {
      const report = await inspectionService.getDailyReport(TEST_DATE);
      
      expect(report.date).toBe(TEST_DATE);
      expect(report.totalOrders).toBeGreaterThan(0);
      expect(report.submittedOrders).toBeGreaterThan(0);
      expect(report.approvedOrders).toBe(1);
      expect(report.totalWeight).toBeGreaterThan(0);
      expect(report.totalLossWeight).toBeGreaterThan(0);
      expect(report.averageLossRate).toBeGreaterThan(0);
      expect(report.liveSeafoodLossRate).toBeGreaterThan(0);
      expect(report.icedSeafoodLossRate).toBeGreaterThanOrEqual(0);
    });

    it('导出报表、详情接口和历史列表应该使用同一套计算口径', async () => {
      const exportData = await inspectionService.exportReportData(TEST_DATE);
      
      let detailTotalWeight = 0;
      let detailTotalLossWeight = 0;

      for (const order of exportData.orders) {
        detailTotalWeight += order.totalWeight;
        detailTotalLossWeight += order.totalLossWeight;
      }

      expect(detailTotalWeight).toBeCloseTo(exportData.report.totalWeight, 5);
      expect(detailTotalLossWeight).toBeCloseTo(exportData.report.totalLossWeight, 5);

      const firstOrderId = exportData.orders[0].id;
      const orderDetail = await inspectionService.getOrderWithItems(firstOrderId);
      
      let itemsTotalWeight = 0;
      let itemsTotalLossWeight = 0;
      for (const item of orderDetail!.items) {
        itemsTotalWeight += item.actualWeight;
        itemsTotalLossWeight += item.lossWeight;
      }

      expect(itemsTotalWeight).toBeCloseTo(orderDetail!.order.totalWeight, 5);
      expect(itemsTotalLossWeight).toBeCloseTo(orderDetail!.order.totalLossWeight, 5);

      const summary = calculationService.calculateOrderSummary(exportData.items);
      expect(summary.totalWeight).toBeCloseTo(exportData.report.totalWeight, 5);
      expect(summary.totalLossWeight).toBeCloseTo(exportData.report.totalLossWeight, 5);
      expect(summary.totalLossRate).toBeCloseTo(exportData.report.averageLossRate, 5);
    });

    it('活鲜损耗率应该高于冰鲜损耗率', async () => {
      const report = await inspectionService.getDailyReport(TEST_DATE);
      expect(report.liveSeafoodLossRate).toBeGreaterThan(report.icedSeafoodLossRate);
    });
  });

  describe('状态流转边界测试', () => {
    let orderId: string;

    beforeEach(async () => {
      const request: CreateOrderRequest = {
        supplierId: 'SUP004',
        supplierName: '测试供应商',
        deliveryDate: TEST_DATE,
        items: [
          {
            seafoodType: 'fish',
            seafoodName: '测试鱼',
            isLive: 0,
            expectedQuantity: 10,
            expectedWeight: 10,
            actualQuantity: 10,
            actualWeight: 10
          }
        ],
        operatorId: 'OP001',
        operatorName: '测试员'
      };
      const order = await inspectionService.createOrder(request);
      orderId = order.id;
    });

    it('草稿状态不能直接审批', async () => {
      await expect(
        inspectionService.approveOrder(orderId, 'OP001', '测试员')
      ).rejects.toThrow('只有人工处理中的验收单才能审批通过');
    });

    it('已提交状态不能直接修改', async () => {
      await inspectionService.submitOrder(orderId, { operatorId: 'OP001' });
      await expect(
        inspectionService.updateOrder(orderId, { remark: '测试修改' })
      ).rejects.toThrow('只有草稿或已撤回状态的验收单才能修改');
    });

    it('已拒绝状态不能撤回', async () => {
      await inspectionService.submitOrder(orderId, { operatorId: 'OP001' });
      await inspectionService.startManualProcess(orderId, { operatorId: 'OP001', remark: '测试' });
      await inspectionService.rejectOrder(orderId, 'OP001', '测试员');
      await expect(
        inspectionService.withdrawOrder(orderId, { operatorId: 'OP001' })
      ).rejects.toThrow('只有已提交或人工处理中的验收单才能撤回');
    });
  });
});
