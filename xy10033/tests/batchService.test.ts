import { v4 as uuidv4 } from 'uuid';
import { getDatabase, closeDatabase } from '../src/electron/database';
import * as reorderService from '../src/electron/services/reorderService';
import * as batchService from '../src/electron/services/batchService';
import { ReissueStatus, UserRole, User } from '../src/shared/types';

process.env.NODE_ENV = 'test';

describe('Batch Service', () => {
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

  describe('batchChangeStatus', () => {
    it('should change status for multiple orders', () => {
      const order1 = reorderService.createOrder({
        orderNo: 'RS202605097771',
        customerName: '客户1',
        customerPhone: '13800007771',
        productName: '商品1',
        quantity: 1,
        reason: '补发'
      }, operator);

      const order2 = reorderService.createOrder({
        orderNo: 'RS202605097772',
        customerName: '客户2',
        customerPhone: '13800007772',
        productName: '商品2',
        quantity: 1,
        reason: '补发'
      }, operator);

      const result = batchService.batchChangeStatus(
        [order1.id, order2.id],
        ReissueStatus.PROCESSING,
        '批量开始处理',
        operator
      );

      expect(result.success.length).toBe(2);
      expect(result.failed.length).toBe(0);

      const updatedOrder1 = reorderService.getOrderById(order1.id)!;
      const updatedOrder2 = reorderService.getOrderById(order2.id)!;

      expect(updatedOrder1.status).toBe(ReissueStatus.PROCESSING);
      expect(updatedOrder2.status).toBe(ReissueStatus.PROCESSING);
    });

    it('should handle partial failures', () => {
      const order = reorderService.createOrder({
        orderNo: 'RS202605097773',
        customerName: '客户3',
        customerPhone: '13800007773',
        productName: '商品3',
        quantity: 1,
        reason: '补发'
      }, operator);

      const result = batchService.batchChangeStatus(
        [order.id, 'non-existent-id'],
        ReissueStatus.PROCESSING,
        '批量处理',
        operator
      );

      expect(result.success.length).toBe(1);
      expect(result.failed.length).toBe(1);
      expect(result.failed[0].orderId).toBe('non-existent-id');
    });
  });

  describe('batchAssignOrders', () => {
    it('should assign multiple orders to same user', () => {
      const order1 = reorderService.createOrder({
        orderNo: 'RS202605097774',
        customerName: '客户4',
        customerPhone: '13800007774',
        productName: '商品4',
        quantity: 1,
        reason: '补发'
      }, operator);

      const order2 = reorderService.createOrder({
        orderNo: 'RS202605097775',
        customerName: '客户5',
        customerPhone: '13800007775',
        productName: '商品5',
        quantity: 1,
        reason: '补发'
      }, operator);

      const result = batchService.batchAssignOrders(
        [order1.id, order2.id],
        'new-assignee-id',
        '新处理人',
        operator
      );

      expect(result.success.length).toBe(2);
      expect(result.failed.length).toBe(0);

      const updatedOrder1 = reorderService.getOrderById(order1.id)!;
      const updatedOrder2 = reorderService.getOrderById(order2.id)!;

      expect(updatedOrder1.assigneeId).toBe('new-assignee-id');
      expect(updatedOrder1.assigneeName).toBe('新处理人');
      expect(updatedOrder2.assigneeId).toBe('new-assignee-id');
      expect(updatedOrder2.assigneeName).toBe('新处理人');
    });
  });

  describe('recordFailedOperation', () => {
    it('should record failed operation', () => {
      batchService.recordFailedOperation('test-order-id', 'status_change', '测试错误');
      
      const failedOps = batchService.listFailedOperations();
      expect(failedOps.length).toBeGreaterThan(0);
      expect(failedOps[0].targetId).toBe('test-order-id');
      expect(failedOps[0].operationType).toBe('status_change');
      expect(failedOps[0].errorMessage).toBe('测试错误');
    });

    it('should increment retry count for existing failures', () => {
      batchService.recordFailedOperation('test-order-id-2', 'status_change', '第一次错误');
      batchService.recordFailedOperation('test-order-id-2', 'status_change', '第二次错误');
      
      const failedOps = batchService.listFailedOperations();
      const targetOp = failedOps.find(op => op.targetId === 'test-order-id-2');
      
      expect(targetOp).toBeDefined();
      expect(targetOp!.retryCount).toBe(2);
    });
  });

  describe('clearFailedOperation', () => {
    it('should clear failed operation', () => {
      batchService.recordFailedOperation('test-order-id-3', 'status_change', '要清除的错误');
      
      const failedOps = batchService.listFailedOperations();
      const targetOp = failedOps.find(op => op.targetId === 'test-order-id-3');
      expect(targetOp).toBeDefined();

      const result = batchService.clearFailedOperation(targetOp!.id, operator);
      expect(result).toBe(true);

      const failedOpsAfter = batchService.listFailedOperations();
      const targetOpAfter = failedOpsAfter.find(op => op.targetId === 'test-order-id-3');
      expect(targetOpAfter).toBeUndefined();
    });
  });
});
