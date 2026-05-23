const db = require('../src/config/database');

const machines = [
  { machine_id: 'WASH-001', location: '1号楼洗衣房A区', status: 'active' },
  { machine_id: 'WASH-002', location: '1号楼洗衣房A区', status: 'active' },
  { machine_id: 'WASH-003', location: '2号楼洗衣房B区', status: 'maintenance' },
  { machine_id: 'DRY-001', location: '1号楼洗衣房A区', status: 'active' }
];

const payments = [
  { payment_id: 'PAY-20240515-001', machine_id: 'WASH-001', amount: 8.00, pay_time: '2024-05-15 09:30:00', payer_id: 'USER-123', pay_channel: 'wechat', status: 'success' },
  { payment_id: 'PAY-20240515-002', machine_id: 'WASH-001', amount: 8.00, pay_time: '2024-05-15 10:15:00', payer_id: 'USER-456', pay_channel: 'alipay', status: 'success' },
  { payment_id: 'PAY-20240515-003', machine_id: 'WASH-002', amount: 12.00, pay_time: '2024-05-15 11:00:00', payer_id: 'USER-789', pay_channel: 'wechat', status: 'success' },
  { payment_id: 'PAY-20240515-004', machine_id: 'WASH-001', amount: 8.00, pay_time: '2024-05-15 14:20:00', payer_id: 'USER-101', pay_channel: 'alipay', status: 'refunded' }
];

const startEvents = [
  { event_id: 'EVT-001', machine_id: 'WASH-001', payment_id: 'PAY-20240515-001', start_time: '2024-05-15 09:30:15', success: false, error_code: 'E001', error_message: '电机启动失败，无法转动' },
  { event_id: 'EVT-002', machine_id: 'WASH-001', payment_id: 'PAY-20240515-002', start_time: '2024-05-15 10:15:30', success: false, error_code: 'E002', error_message: '进水阀故障，无法进水' },
  { event_id: 'EVT-003', machine_id: 'WASH-002', payment_id: 'PAY-20240515-003', start_time: '2024-05-15 11:00:20', success: true, error_code: null, error_message: null }
];

const faultCodes = [
  { code: 'E001', description: '电机启动失败', severity: 'high', auto_refund_eligible: 1 },
  { code: 'E002', description: '进水阀故障', severity: 'high', auto_refund_eligible: 1 },
  { code: 'E003', description: '排水超时', severity: 'medium', auto_refund_eligible: 1 },
  { code: 'E004', description: '温度传感器异常', severity: 'low', auto_refund_eligible: 0 },
  { code: 'E005', description: '门开关故障', severity: 'medium', auto_refund_eligible: 0 }
];

const refundApplications = [
  {
    refund_id: 'REF-001',
    machine_id: 'WASH-001',
    payment_id: 'PAY-20240515-001',
    start_event_id: 'EVT-001',
    fault_code: 'E001',
    fault_screenshot: 'screenshot_001.jpg',
    applicant_name: '张三',
    applicant_phone: '13800138001',
    reason: '机器无法启动，显示E001错误',
    amount: 8.00,
    status: 'completed',
    raw_input: '{"machine_id":"WASH-001","payment_id":"PAY-20240515-001","fault_code":"E001","amount":8}'
  }
];

const processingLogs = [
  {
    log_id: 'LOG-001',
    refund_id: 'REF-001',
    action: 'application_created',
    operator: 'system',
    conclusion: '申请已创建',
    remarks: '自动匹配到启动事件EVT-001'
  },
  {
    log_id: 'LOG-002',
    refund_id: 'REF-001',
    action: 'status_change_to_verifying',
    operator: 'system',
    conclusion: '进入自动核验流程',
    remarks: ''
  },
  {
    log_id: 'LOG-003',
    refund_id: 'REF-001',
    action: 'status_change_to_approved',
    operator: 'admin',
    conclusion: '审核通过',
    remarks: '故障属实，同意退款'
  },
  {
    log_id: 'LOG-004',
    refund_id: 'REF-001',
    action: 'status_change_to_refunding',
    operator: 'system',
    conclusion: '退款处理中',
    remarks: '已提交至支付通道'
  },
  {
    log_id: 'LOG-005',
    refund_id: 'REF-001',
    action: 'status_change_to_completed',
    operator: 'system',
    conclusion: '退款完成',
    remarks: '退款已到账'
  }
];

function initData() {
  db.serialize(() => {
    console.log('开始初始化样例数据...');

    const insertMachine = db.prepare('INSERT OR IGNORE INTO machines (machine_id, location, status) VALUES (?, ?, ?)');
    machines.forEach(m => {
      insertMachine.run(m.machine_id, m.location, m.status);
    });
    insertMachine.finalize();
    console.log(`已初始化 ${machines.length} 台机器数据`);

    const insertPayment = db.prepare('INSERT OR IGNORE INTO payments (payment_id, machine_id, amount, pay_time, payer_id, pay_channel, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
    payments.forEach(p => {
      insertPayment.run(p.payment_id, p.machine_id, p.amount, p.pay_time, p.payer_id, p.pay_channel, p.status);
    });
    insertPayment.finalize();
    console.log(`已初始化 ${payments.length} 条支付记录`);

    const insertEvent = db.prepare('INSERT OR IGNORE INTO start_events (event_id, machine_id, payment_id, start_time, success, error_code, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)');
    startEvents.forEach(e => {
      insertEvent.run(e.event_id, e.machine_id, e.payment_id, e.start_time, e.success ? 1 : 0, e.error_code, e.error_message);
    });
    insertEvent.finalize();
    console.log(`已初始化 ${startEvents.length} 条启动事件`);

    const insertFaultCode = db.prepare('INSERT OR IGNORE INTO fault_codes (code, description, severity, auto_refund_eligible) VALUES (?, ?, ?, ?)');
    faultCodes.forEach(f => {
      insertFaultCode.run(f.code, f.description, f.severity, f.auto_refund_eligible);
    });
    insertFaultCode.finalize();
    console.log(`已初始化 ${faultCodes.length} 条故障代码`);

    const insertRefund = db.prepare('INSERT OR IGNORE INTO refund_applications (refund_id, machine_id, payment_id, start_event_id, fault_code, fault_screenshot, applicant_name, applicant_phone, reason, amount, status, raw_input) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    refundApplications.forEach(r => {
      insertRefund.run(r.refund_id, r.machine_id, r.payment_id, r.start_event_id, r.fault_code, r.fault_screenshot, r.applicant_name, r.applicant_phone, r.reason, r.amount, r.status, r.raw_input);
    });
    insertRefund.finalize();
    console.log(`已初始化 ${refundApplications.length} 条退款申请`);

    const insertLog = db.prepare('INSERT OR IGNORE INTO processing_logs (log_id, refund_id, action, operator, conclusion, remarks) VALUES (?, ?, ?, ?, ?, ?)');
    processingLogs.forEach(l => {
      insertLog.run(l.log_id, l.refund_id, l.action, l.operator, l.conclusion, l.remarks);
    });
    insertLog.finalize();
    console.log(`已初始化 ${processingLogs.length} 条处理日志`);

    console.log('样例数据初始化完成！');
    console.log('\n可用测试数据:');
    console.log('- 机器编号: WASH-001, WASH-002, WASH-003, DRY-001');
    console.log('- 支付流水: PAY-20240515-001 (WASH-001, 8元, 有故障记录)');
    console.log('- 支付流水: PAY-20240515-002 (WASH-001, 8元, 有故障记录)');
    console.log('- 支付流水: PAY-20240515-003 (WASH-002, 12元, 启动成功)');
    console.log('- 故障代码: E001, E002, E003, E004, E005');
    console.log('- 退款申请: REF-001 (已完成状态)');
  });

  db.close();
}

initData();
