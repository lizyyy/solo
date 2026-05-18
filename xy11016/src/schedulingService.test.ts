import { v4 as uuidv4 } from 'uuid';
import { store } from './store';
import { orderService } from './services/orderService';
import { schedulingService } from './services/schedulingService';
import { Order, OrderStatus, OrderUrgency, CakeFlavor, CakeSize } from './types';

describe('烘焙工坊蛋糕急单排产测试', () => {
  let oven1Id: string;
  let oven2Id: string;
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const operator = '张师傅';

  beforeEach(() => {
    store.clearAll();
    
    const oven1 = {
      id: uuidv4(),
      ovenNumber: 'OVEN-001',
      name: '一号烘焙烤箱',
      capacity: 3,
      maxTemperature: 250,
      status: 'active' as const
    };
    oven1Id = oven1.id;
    store.addOven(oven1);

    const oven2 = {
      id: uuidv4(),
      ovenNumber: 'OVEN-002',
      name: '二号烘焙烤箱',
      capacity: 4,
      maxTemperature: 280,
      status: 'active' as const
    };
    oven2Id = oven2.id;
    store.addOven(oven2);
  });

  describe('场景一：正常单排产流程', () => {
    test('应能创建并正常排产普通订单', () => {
      const order = orderService.createOrder({
        customerName: '张三',
        customerPhone: '13800138001',
        deliveryAddress: '北京市朝阳区',
        deliveryTime: `${tomorrow} 14:00`,
        cakeName: '经典黑森林',
        cakeFlavor: CakeFlavor.BLACK_FOREST,
        cakeSize: CakeSize.SIZE_8,
        cakeWeight: 1.2,
        layers: 3,
        specialRequirements: '不要樱桃装饰',
        urgency: OrderUrgency.NORMAL,
        bakingDuration: 50,
        coolingDuration: 40
      }, operator);

      expect(order).toBeDefined();
      expect(order.orderNo).toMatch(/^BK\d{8}\d{4}$/);
      expect(order.status).toBe(OrderStatus.DRAFT);

      const updated = orderService.updateStatus(order.id, OrderStatus.PENDING_SCHEDULE, operator, '信息确认完毕');
      expect(updated?.status).toBe(OrderStatus.PENDING_SCHEDULE);

      const history = orderService.getOrderHistory(order.id);
      expect(history.length).toBeGreaterThan(0);
      expect(history.some(h => h.operationType === 'status_change')).toBe(true);
    });
  });

  describe('场景二：同一烤箱时段被急单挤占', () => {
    test('急单应能挤占已有普通订单的时段', () => {
      const normalOrder = orderService.createOrder({
        customerName: '普通客户',
        cakeName: '普通蛋糕',
        cakeSize: CakeSize.SIZE_6,
        urgency: OrderUrgency.NORMAL
      }, operator);
      orderService.updateStatus(normalOrder.id, OrderStatus.PENDING_SCHEDULE, operator, '确认');
      
      const scheduleResult = schedulingService['executeScheduling'](
        normalOrder,
        oven1Id,
        tomorrow,
        '08:00-10:00'
      );
      expect(scheduleResult.success).toBe(true);
      const updatedNormalOrder = store.getOrderById(normalOrder.id);
      expect(updatedNormalOrder?.scheduledOvenId).toBe(oven1Id);

      const urgentOrder = orderService.createOrder({
        customerName: '急单客户',
        cakeName: '急单蛋糕',
        cakeSize: CakeSize.SIZE_8,
        urgency: OrderUrgency.URGENT
      }, operator);
      orderService.updateStatus(urgentOrder.id, OrderStatus.PENDING_SCHEDULE, operator, '急单确认');

      const conflictCheck = schedulingService.checkTimeSlotConflict(
        oven1Id,
        tomorrow,
        '08:00-10:00'
      );
      expect(conflictCheck.conflict).toBe(true);
      expect(conflictCheck.orders.length).toBe(1);
    });

    test('特级急单应优先排产', () => {
      for (let i = 0; i < 5; i++) {
        const normalOrder = orderService.createOrder({
          customerName: `普通客户${i}`,
          cakeName: `蛋糕${i}`,
          cakeSize: CakeSize.SIZE_6,
          urgency: OrderUrgency.NORMAL
        }, operator);
        orderService.updateStatus(normalOrder.id, OrderStatus.PENDING_SCHEDULE, operator, '确认');
        schedulingService['executeScheduling'](normalOrder, oven1Id, tomorrow, ['08:00-10:00', '10:00-12:00', '14:00-16:00', '16:00-18:00', '18:00-20:00'][i]);
      }

      const superUrgentOrder = orderService.createOrder({
        customerName: '特级急单客户',
        cakeName: '重要生日蛋糕',
        cakeSize: CakeSize.SIZE_10,
        urgency: OrderUrgency.SUPER_URGENT,
        specialRequirements: '婚礼急用，必须今天下午完成'
      }, operator);
      orderService.updateStatus(superUrgentOrder.id, OrderStatus.PENDING_SCHEDULE, operator, '特级急单确认');

      const result = schedulingService.scheduleUrgentOrder(superUrgentOrder.id);
      expect(result.success).toBe(true);
      expect(result.message).toContain('排产成功');
    });
  });

  describe('场景三：产能表一致性校验', () => {
    test('排产后产能记录应正确更新', () => {
      const order1 = orderService.createOrder({
        customerName: '客户1',
        cakeName: '蛋糕1',
        cakeSize: CakeSize.SIZE_8,
        urgency: OrderUrgency.NORMAL
      }, operator);
      orderService.updateStatus(order1.id, OrderStatus.PENDING_SCHEDULE, operator, '确认');

      const result1 = schedulingService['executeScheduling'](order1, oven1Id, tomorrow, '08:00-10:00');
      expect(result1.success).toBe(true);

      const capacity1 = schedulingService.calculateRequiredCapacity(order1);
      expect(capacity1).toBe(1.5);

      const verification = schedulingService.verifyCapacityConsistency(oven1Id, tomorrow);
      expect(verification.valid).toBe(true);
      expect(verification.details.length).toBe(0);
    });

    test('多订单排产后总产能不应超过烤箱容量', () => {
      for (let i = 0; i < 2; i++) {
        const order = orderService.createOrder({
          customerName: `客户${i}`,
          cakeName: `蛋糕${i}`,
          cakeSize: CakeSize.SIZE_10,
          urgency: OrderUrgency.NORMAL
        }, operator);
        orderService.updateStatus(order.id, OrderStatus.PENDING_SCHEDULE, operator, '确认');
        schedulingService['executeScheduling'](order, oven1Id, tomorrow, '08:00-10:00');
      }

      const order3 = orderService.createOrder({
        customerName: '客户3',
        cakeName: '大蛋糕',
        cakeSize: CakeSize.SIZE_12,
        urgency: OrderUrgency.NORMAL
      }, operator);
      orderService.updateStatus(order3.id, OrderStatus.PENDING_SCHEDULE, operator, '确认');

      const result = schedulingService['executeScheduling'](order3, oven1Id, tomorrow, '08:00-10:00');
      expect(result.success).toBe(false);
      expect(result.message).toContain('产能不足');
    });
  });

  describe('场景四：撤回后再次提交的组合情况', () => {
    test('撤回订单后产能应正确释放', () => {
      const order = orderService.createOrder({
        customerName: '测试客户',
        cakeName: '测试蛋糕',
        cakeSize: CakeSize.SIZE_8,
        urgency: OrderUrgency.URGENT
      }, operator);
      orderService.updateStatus(order.id, OrderStatus.PENDING_SCHEDULE, operator, '确认');

      const scheduleResult = schedulingService['executeScheduling'](order, oven1Id, tomorrow, '08:00-10:00');
      expect(scheduleResult.success).toBe(true);

      const beforeRecall = schedulingService.verifyCapacityConsistency(oven1Id, tomorrow);
      expect(beforeRecall.valid).toBe(true);

      const recallSuccess = schedulingService.recallOrder(order.id, '客户要求变更');
      expect(recallSuccess).toBe(true);

      const recalledOrder = store.getOrderById(order.id);
      expect(recalledOrder?.status).toBe(OrderStatus.RECALLED);
      expect(recalledOrder?.scheduledOvenId).toBeNull();

      const afterRecall = schedulingService.verifyCapacityConsistency(oven1Id, tomorrow);
      expect(afterRecall.valid).toBe(true);
    });

    test('撤回后应能重新提交并排产', () => {
      const order = orderService.createOrder({
        customerName: '测试客户',
        cakeName: '测试蛋糕',
        cakeSize: CakeSize.SIZE_8,
        urgency: OrderUrgency.URGENT
      }, operator);
      orderService.updateStatus(order.id, OrderStatus.PENDING_SCHEDULE, operator, '确认');
      schedulingService['executeScheduling'](order, oven1Id, tomorrow, '08:00-10:00');

      schedulingService.recallOrder(order.id, '需要修改配方');
      const history1 = orderService.getOrderHistory(order.id);
      expect(history1.some(h => h.operationType === 'recall')).toBe(true);

      orderService.updateOrder(order.id, { cakeFlavor: CakeFlavor.STRAWBERRY }, operator);
      const history2 = orderService.getOrderHistory(order.id);
      expect(history2.some(h => h.fieldName === 'cakeFlavor')).toBe(true);

      const resubmitResult = schedulingService.resubmitOrder(order.id);
      expect(resubmitResult.success).toBe(true);

      const updatedOrder = store.getOrderById(order.id);
      expect(updatedOrder?.status).toBe(OrderStatus.SCHEDULED);
    });
  });

  describe('场景五：人工处理留痕', () => {
    test('进入人工处理后应能添加备注并重新提交', () => {
      const order = orderService.createOrder({
        customerName: '特殊客户',
        cakeName: '定制蛋糕',
        cakeSize: CakeSize.SIZE_12,
        urgency: OrderUrgency.URGENT,
        specialRequirements: '非常复杂的定制要求'
      }, operator);
      orderService.updateStatus(order.id, OrderStatus.PENDING_SCHEDULE, operator, '确认');

      const manualOrder = orderService.setManualProcessing(
        order.id,
        '李主管',
        '订单需求复杂，需人工确认排产时间'
      );
      expect(manualOrder?.status).toBe(OrderStatus.MANUAL_PROCESSING);
      expect(manualOrder?.currentHandler).toBe('李主管');

      orderService.addRemark(order.id, '已与客户确认，需要额外的装饰时间', '李主管');
      orderService.addRemark(order.id, '已协调二号烤箱预留时段', '李主管');

      const history = orderService.getOrderHistory(order.id);
      const remarkHistory = history.filter(h => h.operationType === 'remark');
      expect(remarkHistory.length).toBe(2);
      expect(remarkHistory[0].remark).toContain('已与客户确认');

      const resubmitResult = schedulingService.resubmitOrder(order.id);
      expect(resubmitResult.success).toBe(true);

      const finalOrder = store.getOrderById(order.id);
      expect(finalOrder?.status).toBe(OrderStatus.SCHEDULED);

      const finalHistory = orderService.getOrderHistory(order.id);
      expect(finalHistory.length).toBeGreaterThan(4);
    });
  });

  describe('场景六：从列表到详情再到历史记录的完整流程', () => {
    test('完整流程测试：列表->详情->历史', () => {
      for (let i = 0; i < 3; i++) {
        const order = orderService.createOrder({
          customerName: `客户${i}`,
          cakeName: `蛋糕${i}`,
          cakeSize: CakeSize.SIZE_6,
          urgency: i === 0 ? OrderUrgency.URGENT : OrderUrgency.NORMAL
        }, operator);
        orderService.updateStatus(order.id, OrderStatus.PENDING_SCHEDULE, operator, '确认');
        if (i === 0) {
          schedulingService.scheduleUrgentOrder(order.id);
          schedulingService.recallOrder(order.id, '测试撤回');
          schedulingService.resubmitOrder(order.id);
        }
      }

      const allOrders = orderService.listOrders();
      expect(allOrders.length).toBe(3);

      const urgentOrders = orderService.listOrders({ urgency: OrderUrgency.URGENT });
      expect(urgentOrders.length).toBe(1);

      const firstOrder = allOrders[0];
      const detail = orderService.getOrderDetail(firstOrder.id);
      expect(detail).toBeDefined();
      expect(detail?.customerName).toBe(firstOrder.customerName);

      const history = orderService.getOrderHistory(firstOrder.id);
      expect(history.length).toBeGreaterThan(0);
      
      const operationTypes = [...new Set(history.map(h => h.operationType))];
      expect(operationTypes).toContain('create');
      expect(operationTypes).toContain('status_change');
    });
  });

  describe('验收场景：初始化后正常单和冲突单稳定运行', () => {
    test('初始化数据后运行正常单和冲突单流程', () => {
      store.clearAll();
      
      const oven = {
        id: uuidv4(),
        ovenNumber: 'OVEN-001',
        name: '一号烘焙烤箱（验收专用）',
        capacity: 3,
        maxTemperature: 250,
        status: 'active' as const
      };
      store.addOven(oven);

      const normalOrder = orderService.createOrder({
        customerName: '王先生',
        customerPhone: '13900139001',
        deliveryAddress: '北京市海淀区中关村大街1号',
        deliveryTime: `${tomorrow} 15:00`,
        cakeName: '经典香草蛋糕',
        cakeFlavor: CakeFlavor.VANILLA,
        cakeSize: CakeSize.SIZE_8,
        cakeWeight: 1.0,
        layers: 2,
        specialRequirements: '标准配方即可',
        urgency: OrderUrgency.NORMAL,
        bakingDuration: 45,
        coolingDuration: 30
      }, '张师傅');
      orderService.updateStatus(normalOrder.id, OrderStatus.PENDING_SCHEDULE, '张师傅', '信息确认完毕');
      
      const normalSchedule = schedulingService['executeScheduling'](
        normalOrder,
        oven.id,
        tomorrow,
        '08:00-10:00'
      );
      expect(normalSchedule.success).toBe(true);

      const conflictOrder = orderService.createOrder({
        customerName: '李女士',
        customerPhone: '13900139002',
        deliveryAddress: '北京市西城区金融街7号',
        deliveryTime: `${tomorrow} 10:00`,
        cakeName: '草莓慕斯蛋糕',
        cakeFlavor: CakeFlavor.STRAWBERRY,
        cakeSize: CakeSize.SIZE_6,
        cakeWeight: 0.8,
        layers: 3,
        specialRequirements: '低糖配方，忌过敏物质',
        urgency: OrderUrgency.URGENT,
        bakingDuration: 40,
        coolingDuration: 50
      }, '李师傅');
      orderService.updateStatus(conflictOrder.id, OrderStatus.PENDING_SCHEDULE, '李师傅', '急单确认');

      const conflictSchedule = schedulingService.scheduleUrgentOrder(conflictOrder.id);
      expect(conflictSchedule.success).toBe(true);

      const normalAfter = store.getOrderById(normalOrder.id);
      const conflictAfter = store.getOrderById(conflictOrder.id);
      
      expect(normalAfter?.scheduledOvenId).toBeDefined();
      expect(conflictAfter?.scheduledOvenId).toBeDefined();
      expect(conflictAfter?.status).toBe(OrderStatus.SCHEDULED);

      const normalHistory = orderService.getOrderHistory(normalOrder.id);
      const conflictHistory = orderService.getOrderHistory(conflictOrder.id);
      
      expect(normalHistory.length).toBeGreaterThan(0);
      expect(conflictHistory.length).toBeGreaterThan(0);

      const verification = schedulingService.verifyCapacityConsistency(oven.id, tomorrow);
      expect(verification.valid).toBe(true);

      console.log('=== 验收场景运行结果 ===');
      console.log('正常单:', normalAfter?.orderNo, normalAfter?.status);
      console.log('急单:', conflictAfter?.orderNo, conflictAfter?.status);
      console.log('产能校验:', verification.valid ? '通过' : '失败');
      console.log('正常单历史记录数:', normalHistory.length);
      console.log('急单历史记录数:', conflictHistory.length);
    });
  });
});