const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '../../data/arbitration.db');
const db = new sqlite3.Database(DB_PATH);

const now = new Date().toISOString();

const orders = [
  {
    id: uuidv4(),
    order_no: 'ORD20260510001',
    user_id: 'USER001',
    total_amount: 299.00,
    status: 'PAYMENT_SUCCESS',
    created_at: '2026-05-10T09:00:00.000Z',
    updated_at: '2026-05-10T09:05:00.000Z'
  },
  {
    id: uuidv4(),
    order_no: 'ORD20260511002',
    user_id: 'USER002',
    total_amount: 599.00,
    status: 'LOGISTICS_CANCELLED',
    created_at: '2026-05-11T10:30:00.000Z',
    updated_at: '2026-05-11T14:20:00.000Z'
  },
  {
    id: uuidv4(),
    order_no: 'ORD20260512003',
    user_id: 'USER003',
    total_amount: 158.00,
    status: 'DISCOUNT_ERROR',
    created_at: '2026-05-12T15:00:00.000Z',
    updated_at: '2026-05-12T15:01:00.000Z'
  }
];

const exceptions = [
  {
    id: uuidv4(),
    order_id: orders[0].id,
    exception_type: 'INVENTORY_FAILURE',
    status: 'PENDING',
    locked_by: null,
    locked_at: null,
    resolution: null,
    resolution_reason: null,
    resolved_at: null,
    evidence_gap: '支付凭证与库存扣减记录不匹配',
    created_at: '2026-05-10T09:10:00.000Z',
    updated_at: '2026-05-10T09:10:00.000Z'
  },
  {
    id: uuidv4(),
    order_id: orders[1].id,
    exception_type: 'LOGISTICS_CANCEL',
    status: 'PENDING',
    locked_by: null,
    locked_at: null,
    resolution: null,
    resolution_reason: null,
    resolved_at: null,
    evidence_gap: '物流取消原因记录缺失',
    created_at: '2026-05-11T14:30:00.000Z',
    updated_at: '2026-05-11T14:30:00.000Z'
  },
  {
    id: uuidv4(),
    order_id: orders[2].id,
    exception_type: 'DISCOUNT_EXCEPTION',
    status: 'PENDING',
    locked_by: null,
    locked_at: null,
    resolution: null,
    resolution_reason: null,
    resolved_at: null,
    evidence_gap: '优惠卷使用规则与实际抵扣金额不一致',
    created_at: '2026-05-12T15:10:00.000Z',
    updated_at: '2026-05-12T15:10:00.000Z'
  }
];

const evidences = [
  {
    id: uuidv4(),
    order_exception_id: exceptions[0].id,
    evidence_type: 'PAYMENT',
    evidence_data: JSON.stringify({
      transaction_id: 'TXN20260510001',
      amount: 299.00,
      success: true,
      method: 'ALIPAY',
      timestamp: '2026-05-10T09:05:00.000Z'
    }),
    is_valid: 1,
    created_at: '2026-05-10T09:06:00.000Z'
  },
  {
    id: uuidv4(),
    order_exception_id: exceptions[0].id,
    evidence_type: 'INVENTORY',
    evidence_data: JSON.stringify({
      sku_id: 'SKU001',
      requested_quantity: 1,
      actual_deducted: 0,
      error_message: '库存不足',
      timestamp: '2026-05-10T09:04:00.000Z'
    }),
    is_valid: 1,
    created_at: '2026-05-10T09:07:00.000Z'
  },
  {
    id: uuidv4(),
    order_exception_id: exceptions[1].id,
    evidence_type: 'PAYMENT',
    evidence_data: JSON.stringify({
      transaction_id: 'TXN20260511002',
      amount: 599.00,
      success: true,
      method: 'WECHAT',
      timestamp: '2026-05-11T10:35:00.000Z'
    }),
    is_valid: 1,
    created_at: '2026-05-11T10:36:00.000Z'
  },
  {
    id: uuidv4(),
    order_exception_id: exceptions[1].id,
    evidence_type: 'LOGISTICS',
    evidence_data: JSON.stringify({
      logistics_no: 'WL20260511001',
      status: 'CANCELLED',
      cancel_time: '2026-05-11T14:15:00.000Z'
    }),
    is_valid: 1,
    created_at: '2026-05-11T14:25:00.000Z'
  },
  {
    id: uuidv4(),
    order_exception_id: exceptions[2].id,
    evidence_type: 'PAYMENT',
    evidence_data: JSON.stringify({
      transaction_id: 'TXN20260512003',
      amount: 158.00,
      success: true,
      method: 'WECHAT',
      timestamp: '2026-05-12T15:02:00.000Z'
    }),
    is_valid: 1,
    created_at: '2026-05-12T15:03:00.000Z'
  },
  {
    id: uuidv4(),
    order_exception_id: exceptions[2].id,
    evidence_type: 'DISCOUNT',
    evidence_data: JSON.stringify({
      coupon_id: 'COUPON001',
      coupon_name: '新人满100减20',
      expected_discount: 20.00,
      actual_discount: 0.00
    }),
    is_valid: 1,
    created_at: '2026-05-12T15:08:00.000Z'
  }
];

const operators = [
  {
    id: uuidv4(),
    name: '张客服',
    role: 'CUSTOMER_SERVICE',
    created_at: now
  },
  {
    id: uuidv4(),
    name: '李主管',
    role: 'SUPERVISOR',
    created_at: now
  }
];

const timelines = [
  {
    id: uuidv4(),
    order_id: orders[0].id,
    event_type: 'ORDER_CREATED',
    event_data: JSON.stringify({ message: '订单创建成功' }),
    operator: 'SYSTEM',
    created_at: '2026-05-10T09:00:00.000Z'
  },
  {
    id: uuidv4(),
    order_id: orders[0].id,
    event_type: 'PAYMENT_SUCCESS',
    event_data: JSON.stringify({ message: '支付成功，金额：299.00元' }),
    operator: 'SYSTEM',
    created_at: '2026-05-10T09:05:00.000Z'
  },
  {
    id: uuidv4(),
    order_id: orders[0].id,
    event_type: 'INVENTORY_FAILED',
    event_data: JSON.stringify({ message: '库存扣减失败，SKU: SKU001，原因：库存不足' }),
    operator: 'SYSTEM',
    created_at: '2026-05-10T09:07:00.000Z'
  },
  {
    id: uuidv4(),
    order_id: orders[0].id,
    event_type: 'EXCEPTION_CREATED',
    event_data: JSON.stringify({ message: '异常订单创建，等待人工处理' }),
    operator: 'SYSTEM',
    created_at: '2026-05-10T09:10:00.000Z'
  },
  {
    id: uuidv4(),
    order_id: orders[1].id,
    event_type: 'ORDER_CREATED',
    event_data: JSON.stringify({ message: '订单创建成功' }),
    operator: 'SYSTEM',
    created_at: '2026-05-11T10:30:00.000Z'
  },
  {
    id: uuidv4(),
    order_id: orders[1].id,
    event_type: 'PAYMENT_SUCCESS',
    event_data: JSON.stringify({ message: '支付成功，金额：599.00元' }),
    operator: 'SYSTEM',
    created_at: '2026-05-11T10:35:00.000Z'
  },
  {
    id: uuidv4(),
    order_id: orders[1].id,
    event_type: 'LOGISTICS_DISPATCHED',
    event_data: JSON.stringify({ message: '物流已发货，单号：WL20260511001' }),
    operator: 'SYSTEM',
    created_at: '2026-05-11T11:00:00.000Z'
  },
  {
    id: uuidv4(),
    order_id: orders[1].id,
    event_type: 'LOGISTICS_CANCELLED',
    event_data: JSON.stringify({ message: '物流取消' }),
    operator: 'SYSTEM',
    created_at: '2026-05-11T14:15:00.000Z'
  },
  {
    id: uuidv4(),
    order_id: orders[1].id,
    event_type: 'EXCEPTION_CREATED',
    event_data: JSON.stringify({ message: '异常订单创建，等待人工处理' }),
    operator: 'SYSTEM',
    created_at: '2026-05-11T14:30:00.000Z'
  },
  {
    id: uuidv4(),
    order_id: orders[2].id,
    event_type: 'ORDER_CREATED',
    event_data: JSON.stringify({ message: '订单创建成功' }),
    operator: 'SYSTEM',
    created_at: '2026-05-12T15:00:00.000Z'
  },
  {
    id: uuidv4(),
    order_id: orders[2].id,
    event_type: 'PAYMENT_SUCCESS',
    event_data: JSON.stringify({ message: '支付成功，金额：158.00元' }),
    operator: 'SYSTEM',
    created_at: '2026-05-12T15:02:00.000Z'
  },
  {
    id: uuidv4(),
    order_id: orders[2].id,
    event_type: 'EXCEPTION_CREATED',
    event_data: JSON.stringify({ message: '优惠异常，等待人工处理' }),
    operator: 'SYSTEM',
    created_at: '2026-05-12T15:10:00.000Z'
  }
];

db.serialize(() => {
  const stmt = db.prepare('INSERT OR REPLACE INTO orders VALUES (?, ?, ?, ?, ?, ?, ?)');
  orders.forEach(order => {
    stmt.run(order.id, order.order_no, order.user_id, order.total_amount, order.status, order.created_at, order.updated_at);
  });
  stmt.finalize();

  const stmt2 = db.prepare('INSERT OR REPLACE INTO order_exceptions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  exceptions.forEach(ex => {
    stmt2.run(ex.id, ex.order_id, ex.exception_type, ex.status, ex.locked_by, ex.locked_at, ex.resolution, ex.resolution_reason, ex.resolved_at, ex.evidence_gap, ex.created_at, ex.updated_at);
  });
  stmt2.finalize();

  const stmt3 = db.prepare('INSERT OR REPLACE INTO order_evidence VALUES (?, ?, ?, ?, ?, ?)');
  evidences.forEach(ev => {
    stmt3.run(ev.id, ev.order_exception_id, ev.evidence_type, ev.evidence_data, ev.is_valid, ev.created_at);
  });
  stmt3.finalize();

  const stmt4 = db.prepare('INSERT OR REPLACE INTO operators VALUES (?, ?, ?, ?)');
  operators.forEach(op => {
    stmt4.run(op.id, op.name, op.role, op.created_at);
  });
  stmt4.finalize();

  const stmt5 = db.prepare('INSERT OR REPLACE INTO order_timeline VALUES (?, ?, ?, ?, ?, ?)');
  timelines.forEach(tl => {
    stmt5.run(tl.id, tl.order_id, tl.event_type, tl.event_data, tl.operator, tl.created_at);
  });
  stmt5.finalize();

  console.log('样例数据插入完成');
});

db.close();
