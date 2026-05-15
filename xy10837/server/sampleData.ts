import { store } from './store';

export function initSampleData() {
  if (store.getMessages().length > 0) {
    return;
  }

  const messages = [
    {
      topic: 'order.created',
      deadReason: 'timeout' as const,
      deadReasonDesc: '调用库存服务超时',
      payloadSummary: '订单ID: ORD-2024-001, 金额: 999.00',
      payload: { orderId: 'ORD-2024-001', amount: 999, userId: 'U10001' },
      originalQueue: 'order-service-queue',
      status: 'dead' as const,
      responsibleNode: 'order-service-01',
      retryCount: 3
    },
    {
      topic: 'order.created',
      deadReason: 'exception' as const,
      deadReasonDesc: 'NullPointerException: 用户不存在',
      payloadSummary: '订单ID: ORD-2024-002, 金额: 199.00',
      payload: { orderId: 'ORD-2024-002', amount: 199, userId: 'U99999' },
      originalQueue: 'order-service-queue',
      status: 'dead' as const,
      responsibleNode: 'order-service-02',
      retryCount: 2
    },
    {
      topic: 'order.created',
      deadReason: 'validation_error' as const,
      deadReasonDesc: '订单金额不能为负数',
      payloadSummary: '订单ID: ORD-2024-003, 金额: -50.00',
      payload: { orderId: 'ORD-2024-003', amount: -50, userId: 'U10003' },
      originalQueue: 'order-service-queue',
      status: 'dead' as const,
      responsibleNode: 'order-service-01',
      retryCount: 1
    },
    {
      topic: 'payment.completed',
      deadReason: 'business_error' as const,
      deadReasonDesc: '订单已取消，无法完成支付',
      payloadSummary: '支付ID: PAY-2024-001, 订单: ORD-2024-004',
      payload: { paymentId: 'PAY-2024-001', orderId: 'ORD-2024-004', status: 'cancelled' },
      originalQueue: 'payment-service-queue',
      status: 'dead' as const,
      responsibleNode: 'payment-service-01',
      retryCount: 2
    },
    {
      topic: 'payment.completed',
      deadReason: 'timeout' as const,
      deadReasonDesc: '调用账务系统超时',
      payloadSummary: '支付ID: PAY-2024-002, 金额: 500.00',
      payload: { paymentId: 'PAY-2024-002', amount: 500, userId: 'U10005' },
      originalQueue: 'payment-service-queue',
      status: 'pending' as const,
      responsibleNode: 'payment-service-02',
      retryCount: 1
    },
    {
      topic: 'user.registered',
      deadReason: 'exception' as const,
      deadReasonDesc: '数据库连接异常',
      payloadSummary: '用户ID: U10006, 邮箱: test@example.com',
      payload: { userId: 'U10006', email: 'test@example.com', phone: '13800138000' },
      originalQueue: 'user-service-queue',
      status: 'success' as const,
      responsibleNode: 'user-service-01',
      retryCount: 5
    },
    {
      topic: 'user.registered',
      deadReason: 'unknown' as const,
      deadReasonDesc: '未知错误',
      payloadSummary: '用户ID: U10007, 邮箱: user7@example.com',
      payload: { userId: 'U10007', email: 'user7@example.com' },
      originalQueue: 'user-service-queue',
      status: 'failed' as const,
      responsibleNode: 'user-service-02',
      retryCount: 3,
      lastError: 'Consumer failed with unknown error'
    },
    {
      topic: 'notification.sent',
      deadReason: 'validation_error' as const,
      deadReasonDesc: '手机号格式错误',
      payloadSummary: '通知类型: SMS, 接收人: invalid-phone',
      payload: { type: 'SMS', to: 'invalid-phone', content: '验证码：123456' },
      originalQueue: 'notification-service-queue',
      status: 'skipped' as const,
      responsibleNode: 'notification-service-01',
      retryCount: 1
    }
  ];

  messages.forEach(msg => store.addMessage(msg));

  store.addRule({
    name: '跳过手机号格式错误',
    topic: 'notification.sent',
    deadReason: 'validation_error',
    payloadPattern: 'invalid-phone',
    enabled: true
  });

  store.addRule({
    name: '跳过订单金额负数',
    topic: 'order.created',
    deadReason: 'validation_error',
    payloadPattern: 'amount.*-',
    enabled: true
  });
}
