const { run, get, uuidv4 } = require('./database');

const initSampleData = async () => {
  try {
    const existingCheck = await get('SELECT COUNT(*) as count FROM device_heartbeats');
    if (existingCheck.count > 0) {
      console.log('Sample data already exists, skipping initialization');
      return;
    }
    
    const devices = [
      { id: 'DEV001', name: 'A区充电桩1号' },
      { id: 'DEV002', name: 'A区充电桩2号' },
      { id: 'DEV003', name: 'B区充电桩1号' }
    ];
    
    const operators = ['张三', '李四', '王五'];
    
    for (const device of devices) {
      const hbId = uuidv4();
      await run(
        'INSERT INTO device_heartbeats (id, device_id, device_name, status, voltage, current, temperature, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [hbId, device.id, device.name, 'online', 220.5, 32.1, 45.2, new Date().toISOString()]
      );
    }
    
    const orders = [
      { no: 'ORD20240101001', device: 'DEV001', user: 'USER001', amount: 58.5, status: 'completed', payment: 'paid' },
      { no: 'ORD20240101002', device: 'DEV001', user: 'USER002', amount: 42.0, status: 'completed', payment: 'failed' },
      { no: 'ORD20240101003', device: 'DEV002', user: 'USER003', amount: 35.5, status: 'charging', payment: 'pending' },
      { no: 'ORD20240101004', device: 'DEV003', user: 'USER004', amount: 89.0, status: 'completed', payment: 'paid' }
    ];
    
    const orderIds = {};
    for (const order of orders) {
      const id = uuidv4();
      orderIds[order.no] = id;
      await run(
        'INSERT INTO charging_orders (id, order_no, device_id, user_id, start_time, charged_kwh, amount, status, payment_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, order.no, order.device, order.user, new Date().toISOString(), order.amount / 1.5, order.amount, order.status, order.payment, new Date().toISOString()]
      );
    }
    
    const restarts = [
      { device: 'DEV001', operator: '张三', reason: '设备远程维护', status: 'completed' },
      { device: 'DEV002', operator: '李四', reason: '充电异常重启', status: 'pending' }
    ];
    
    for (const restart of restarts) {
      const id = uuidv4();
      await run(
        'INSERT INTO remote_restarts (id, device_id, operator, reason, status, restart_time, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, restart.device, restart.operator, restart.reason, restart.status, restart.status === 'completed' ? new Date().toISOString() : null, new Date().toISOString()]
      );
    }
    
    const tickets = [
      { no: 'TK202401001', device: 'DEV001', order: orders[1].no, reporter: '李四', assignee: '王五', type: 'charging_error', desc: '充电过程中突然断电，用户申请退款', priority: 'high', status: 'resolved' },
      { no: 'TK202401002', device: 'DEV002', order: null, reporter: '张三', assignee: '王五', type: 'device_fault', desc: '设备显示离线，无法启动充电', priority: 'high', status: 'in_progress' },
      { no: 'TK202401003', device: 'DEV001', order: orders[0].no, reporter: '王五', assignee: '李四', type: 'refund_request', desc: '用户反馈实际充电量与账单不符', priority: 'medium', status: 'pending_review' },
      { no: 'TK202401004', device: 'DEV003', order: orders[3].no, reporter: '张三', assignee: '李四', type: 'payment_issue', desc: '扣款成功但订单显示未支付', priority: 'medium', status: 'open' }
    ];
    
    const ticketIds = {};
    for (const ticket of tickets) {
      const id = uuidv4();
      ticketIds[ticket.no] = id;
      await run(
        'INSERT INTO repair_tickets (id, ticket_no, device_id, order_id, reporter, assignee, issue_type, description, priority, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, ticket.no, ticket.device, ticket.order ? orderIds[ticket.order] : null, ticket.reporter, ticket.assignee, ticket.type, ticket.desc, ticket.priority, ticket.status, new Date().toISOString()]
      );
    }
    
    const failures = [
      { order: orders[1].no, code: 'PAY001', reason: '银行卡余额不足', status: 'failed' },
      { order: orders[1].no, code: 'PAY001', reason: '银行卡余额不足', status: 'retry_failed' }
    ];
    
    for (const failure of failures) {
      const id = uuidv4();
      await run(
        'INSERT INTO payment_failures (id, order_id, failure_code, failure_reason, status, retry_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, orderIds[failure.order], failure.code, failure.reason, failure.status, failure.status === 'retry_failed' ? 2 : 1, new Date().toISOString()]
      );
    }
    
    const refunds = [
      { no: 'RF202401001', order: orders[1].no, ticket: 'TK202401001', amount: 42.0, reason: '充电中断全额退款', status: 'completed', operator: '张三', reviewer: '王五' },
      { no: 'RF202401002', order: orders[0].no, ticket: 'TK202401003', amount: 15.0, reason: '充电量差异退款', status: 'pending_review', operator: '王五', reviewer: null },
      { no: 'RF202401003', order: orders[3].no, ticket: 'TK202401004', amount: 89.0, reason: '支付异常全额退款', status: 'rejected', operator: '李四', reviewer: '张三' }
    ];
    
    for (const refund of refunds) {
      const id = uuidv4();
      await run(
        'INSERT INTO refund_progress (id, refund_no, order_id, ticket_id, amount, reason, status, operator, reviewer, review_time, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, refund.no, orderIds[refund.order], ticketIds[refund.ticket], refund.amount, refund.reason, refund.status, refund.operator, refund.reviewer, refund.reviewer ? new Date().toISOString() : null, id, new Date().toISOString()]
      );
    }
    
    console.log('Sample data initialized successfully');
  } catch (error) {
    console.error('Error initializing sample data:', error);
  }
};

module.exports = { initSampleData };
