import { v4 as uuidv4 } from 'uuid';
import { getDatabase, closeDatabase } from '../src/electron/database';
import * as reorderService from '../src/electron/services/reorderService';
import { ReissueStatus, UserRole, User } from '../src/shared/types';

process.env.NODE_ENV = 'test';

describe('Reissue Order Service', () => {
  let operator: User;

  beforeEach(() => {
    closeDatabase();
    const db = getDatabase();
    const now = new Date().toISOString();
    const operatorId = uuidv4();
    
    db.prepare(`
      INSERT INTO users (id, username, password, name, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(operatorId, 'operator', 'operator123', '操作人', UserRole.ADMIN, now, now);
    
    operator = {
      id: operatorId,
      username: 'operator',
      password: 'operator123',
      name: '操作人',
      role: UserRole.ADMIN,
      createdAt: now,
      updatedAt: now
    };
  });

  afterAll(() => {
    closeDatabase();
  });

  describe('createOrder', () => {
    it('should create order with pending status', () => {
      const order = reorderService.createOrder({
        orderNo: 'RS202605099999',
        customerName: '测试客户',
        customerPhone: '13800000000',
        customerAddress: '测试地址',
        productName: '测试商品',
        productSku: 'TEST-001',
        quantity: 1,
        reason: '测试补发',
        description: '测试描述'
      }, operator);

      expect(order).toBeDefined();
      expect(order.status).toBe(ReissueStatus.PENDING);
      expect(order.retryCount).toBe(0);
      expect(order.orderNo).toBeDefined();
    });

    it('should auto generate orderNo when not provided', () => {
      const order = reorderService.createOrder({
        orderNo: '',
        customerName: '测试客户',
        customerPhone: '13800000001',
        productName: '测试商品',
        quantity: 1,
        reason: '测试补发'
      }, operator);

      expect(order.orderNo).toBeDefined();
      expect(order.orderNo.length).toBeGreaterThan(0);
    });
  });

  describe('updateOrder', () => {
    it('should update order fields', () => {
      const order = reorderService.createOrder({
        orderNo: 'RS202605099998',
        customerName: '原客户',
        customerPhone: '13800000002',
        productName: '原商品',
        quantity: 1,
        reason: '补发原因'
      }, operator);

      const updatedOrder = reorderService.updateOrder(order.id, {
        customerName: '更新后的客户',
        description: '更新后的描述'
      }, operator);

      expect(updatedOrder.customerName).toBe('更新后的客户');
      expect(updatedOrder.description).toBe('更新后的描述');
    });
  });

  describe('changeOrderStatus', () => {
    it('should change status from pending to processing', () => {
      const order = reorderService.createOrder({
        orderNo: 'RS202605099997',
        customerName: '测试客户',
        customerPhone: '13800000003',
        productName: '测试商品',
        quantity: 1,
        reason: '补发原因'
      }, operator);

      const updatedOrder = reorderService.changeOrderStatus(
        order.id,
        ReissueStatus.PROCESSING,
        '开始处理',
        operator
      );

      expect(updatedOrder.status).toBe(ReissueStatus.PROCESSING);
    });

    it('should throw error for invalid status transition', () => {
      const order = reorderService.createOrder({
        orderNo: 'RS202605099996',
        customerName: '测试客户',
        customerPhone: '13800000004',
        productName: '测试商品',
        quantity: 1,
        reason: '补发原因'
      }, operator);

      expect(() => {
        reorderService.changeOrderStatus(
          order.id,
          ReissueStatus.SHIPPED,
          '直接发货',
          operator
        );
      }).toThrow('状态流转不合法');
    });

    it('should create history record when status changes', () => {
      const order = reorderService.createOrder({
        orderNo: 'RS202605099995',
        customerName: '测试客户',
        customerPhone: '13800000005',
        productName: '测试商品',
        quantity: 1,
        reason: '补发原因'
      }, operator);

      reorderService.changeOrderStatus(
        order.id,
        ReissueStatus.PROCESSING,
        '开始处理',
        operator
      );

      const history = reorderService.getOrderHistory(order.id);
      expect(history.length).toBe(2);
      expect(history[1].afterStatus).toBe(ReissueStatus.PROCESSING);
      expect(history[1].beforeStatus).toBe(ReissueStatus.PENDING);
    });
  });

  describe('listOrders', () => {
    it('should return paginated orders', () => {
      for (let i = 0; i < 5; i++) {
        reorderService.createOrder({
          orderNo: `RS20260509${String(100 + i).padStart(4, '0')}`,
          customerName: `客户${i}`,
          customerPhone: `13800000${String(100 + i)}`,
          productName: `商品${i}`,
          quantity: 1,
          reason: '补发原因'
        }, operator);
      }

      const result = reorderService.listOrders({ page: 1, pageSize: 3 });

      expect(result.total).toBeGreaterThanOrEqual(5);
      expect(result.data.length).toBe(3);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(3);
    });

    it('should filter by status', () => {
      const order1 = reorderService.createOrder({
        orderNo: 'RS202605090090',
        customerName: '客户A',
        customerPhone: '13800000090',
        productName: '商品A',
        quantity: 1,
        reason: '补发原因'
      }, operator);

      const order2 = reorderService.createOrder({
        orderNo: 'RS202605090091',
        customerName: '客户B',
        customerPhone: '13800000091',
        productName: '商品B',
        quantity: 1,
        reason: '补发原因'
      }, operator);

      reorderService.changeOrderStatus(order2.id, ReissueStatus.PROCESSING, '开始处理', operator);

      const pendingResult = reorderService.listOrders({
        page: 1,
        pageSize: 10,
        status: ReissueStatus.PENDING
      });

      const processingResult = reorderService.listOrders({
        page: 1,
        pageSize: 10,
        status: ReissueStatus.PROCESSING
      });

      expect(pendingResult.data.some(o => o.id === order1.id)).toBe(true);
      expect(processingResult.data.some(o => o.id === order2.id)).toBe(true);
    });

    it('should filter by customer name', () => {
      reorderService.createOrder({
        orderNo: 'RS202605090092',
        customerName: '张三',
        customerPhone: '13800000092',
        productName: '商品',
        quantity: 1,
        reason: '补发原因'
      }, operator);

      reorderService.createOrder({
        orderNo: 'RS202605090093',
        customerName: '李四',
        customerPhone: '13800000093',
        productName: '商品',
        quantity: 1,
        reason: '补发原因'
      }, operator);

      const result = reorderService.listOrders({
        page: 1,
        pageSize: 10,
        customerName: '张'
      });

      expect(result.data.every(o => o.customerName.includes('张'))).toBe(true);
    });
  });

  describe('deleteOrder', () => {
    it('should delete order and its history', () => {
      const order = reorderService.createOrder({
        orderNo: 'RS202605090094',
        customerName: '要删除的客户',
        customerPhone: '13800000094',
        productName: '商品',
        quantity: 1,
        reason: '补发原因'
      }, operator);

      reorderService.deleteOrder(order.id, operator);

      const deletedOrder = reorderService.getOrderById(order.id);
      expect(deletedOrder).toBeUndefined();
    });
  });

  describe('getOrderHistory', () => {
    it('should return history in chronological order', () => {
      const order = reorderService.createOrder({
        orderNo: 'RS202605090095',
        customerName: '测试客户',
        customerPhone: '13800000095',
        productName: '测试商品',
        quantity: 1,
        reason: '补发原因'
      }, operator);

      reorderService.changeOrderStatus(order.id, ReissueStatus.PROCESSING, '开始处理', operator);
      reorderService.changeOrderStatus(order.id, ReissueStatus.SHIPPED, '已发货', operator);

      const history = reorderService.getOrderHistory(order.id);

      expect(history.length).toBe(3);
      expect(history[0].afterStatus).toBe(ReissueStatus.PENDING);
      expect(history[1].afterStatus).toBe(ReissueStatus.PROCESSING);
      expect(history[2].afterStatus).toBe(ReissueStatus.SHIPPED);
    });
  });
});
