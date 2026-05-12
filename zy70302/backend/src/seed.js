const db = require('./database');
const taskService = require('./services/taskService');
const businessData = require('./businessData');

const seed = () => {
  db.prepare('DELETE FROM payload_modifications').run();
  db.prepare('DELETE FROM replay_history').run();
  db.prepare('DELETE FROM business_snapshots').run();
  db.prepare('DELETE FROM dead_letters').run();
  db.prepare('DELETE FROM tasks').run();
  db.prepare('DELETE FROM mock_invoices').run();
  db.prepare('DELETE FROM mock_sms').run();
  db.prepare('DELETE FROM mock_inventory_logs').run();
  db.prepare('DELETE FROM mock_inventory').run();

  businessData.initInventory('PROD-001', 'iPhone 15 Pro', 100);
  businessData.initInventory('PROD-002', 'MacBook Air M3', 50);
  businessData.initInventory('PROD-003', 'AirPods Pro 2', 200);

  const invoiceTask = taskService.createTask({
    taskType: 'invoice',
    taskName: '订单开票任务',
    businessNo: 'ORD-2024-001',
    payload: {
      orderId: 'ORD-2024-001',
      customerName: '张三',
      amount: 5999.00,
      taxRate: 0.13,
      invoiceType: 'special',
      remark: '企业客户'
    },
    maxRetry: 3,
    hasSideEffect: false,
    sideEffectType: null
  });
  taskService.moveToDeadLetter(invoiceTask.id, new Error('税控系统连接超时 - Connection timeout'));
  taskService.moveToDeadLetter(invoiceTask.id, new Error('税控系统连接超时 - Connection timeout'));
  taskService.moveToDeadLetter(invoiceTask.id, new Error('税控系统连接超时 - Connection timeout'));

  const smsTask = taskService.createTask({
    taskType: 'sms',
    taskName: '订单通知短信',
    businessNo: 'MSG-2024-001',
    payload: {
      messageId: 'MSG-2024-001',
      phone: '13800138001',
      templateId: 'TPL-ORDER-NOTIFY',
      templateParams: {
        orderNo: 'ORD-2024-002',
        amount: '3299.00',
        status: '已发货'
      },
      content: '【商城】您的订单 ORD-2024-002 已发货，金额 3299.00元'
    },
    maxRetry: 3,
    hasSideEffect: true,
    sideEffectType: 'sms'
  });
  taskService.moveToDeadLetter(smsTask.id, new Error('短信服务商响应超时 - Request timeout after 30s'));
  taskService.moveToDeadLetter(smsTask.id, new Error('短信服务商响应超时 - Request timeout after 30s'));

  const inventoryTask = taskService.createTask({
    taskType: 'inventory',
    taskName: '订单库存扣减',
    businessNo: 'ORD-2024-003',
    payload: {
      orderId: 'ORD-2024-003',
      productId: 'PROD-001',
      productName: 'iPhone 15 Pro',
      quantity: 2,
      reason: '订单支付成功扣减'
    },
    maxRetry: 3,
    hasSideEffect: true,
    sideEffectType: 'inventory'
  });
  taskService.moveToDeadLetter(inventoryTask.id, new Error('库存服务不可用 - Service unavailable (503)'));

  const inventoryTask2 = taskService.createTask({
    taskType: 'inventory',
    taskName: '订单库存扣减',
    businessNo: 'ORD-2024-004',
    payload: {
      orderId: 'ORD-2024-004',
      productId: 'PROD-002',
      productName: 'MacBook Air M3',
      quantity: 1,
      reason: '订单支付成功扣减'
    },
    maxRetry: 3,
    hasSideEffect: true,
    sideEffectType: 'inventory'
  });
  taskService.moveToDeadLetter(inventoryTask2.id, new Error('业务校验失败: 库存不足'));
  taskService.moveToDeadLetter(inventoryTask2.id, new Error('业务校验失败: 库存不足'));
  taskService.moveToDeadLetter(inventoryTask2.id, new Error('业务校验失败: 库存不足'));

  const successTask = taskService.createTask({
    taskType: 'invoice',
    taskName: '已完成开票任务',
    businessNo: 'ORD-2024-005',
    payload: {
      orderId: 'ORD-2024-005',
      customerName: '李四',
      amount: 1299.00,
      taxRate: 0.13,
      invoiceType: 'normal'
    },
    maxRetry: 3,
    hasSideEffect: false
  });
  taskService.updateTaskStatus(successTask.id, 'completed');

  const pendingTask = taskService.createTask({
    taskType: 'sms',
    taskName: '待执行短信任务',
    businessNo: 'MSG-2024-002',
    payload: {
      messageId: 'MSG-2024-002',
      phone: '13900139002',
      templateId: 'TPL-PAYMENT-REMIND',
      templateParams: {
        orderNo: 'ORD-2024-006',
        deadline: '2024-05-15 23:59'
      },
      content: '【商城】您的订单 ORD-2024-006 待支付，请在 2024-05-15 23:59 前完成支付'
    },
    maxRetry: 3,
    hasSideEffect: true,
    sideEffectType: 'sms'
  });

  console.log('Seed data initialized successfully!');
};

module.exports = seed;
