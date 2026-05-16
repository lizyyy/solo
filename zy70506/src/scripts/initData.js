const { v4: uuidv4 } = require('uuid');
const { runAsync, db } = require('../database');

const sampleData = [
  {
    approval_no: 'AP20240101001',
    business_order_no: 'BIZ20240101001',
    callback_event: 'APPROVAL_PASS',
    compensation_action: 'RETRY_CALLBACK',
    status: 'PENDING',
    created_by: 'system',
    raw_input: { orderId: 'BIZ20240101001', status: 'APPROVED', operator: 'admin' }
  },
  {
    approval_no: 'AP20240101002',
    business_order_no: 'BIZ20240101002',
    callback_event: 'APPROVAL_REJECT',
    compensation_action: 'RETRY_CALLBACK',
    status: 'FAILED',
    retry_count: 2,
    max_retry: 3,
    created_by: 'operator_a',
    raw_input: { orderId: 'BIZ20240101002', status: 'REJECTED', reason: '资料不全' },
    error_message: '回调超时'
  },
  {
    approval_no: 'AP20240101003',
    business_order_no: 'BIZ20240101003',
    callback_event: 'APPROVAL_PASS',
    compensation_action: 'MANUAL_FIX',
    status: 'NEED_MANUAL_CONFIRM',
    retry_count: 3,
    max_retry: 3,
    created_by: 'operator_b',
    raw_input: { orderId: 'BIZ20240101003', status: 'APPROVED', amount: 10000 },
    error_message: '目标系统返回500错误'
  },
  {
    approval_no: 'AP20240101004',
    business_order_no: 'BIZ20240101004',
    callback_event: 'APPROVAL_CANCEL',
    compensation_action: 'RETRY_CALLBACK',
    status: 'SUCCESS',
    retry_count: 1,
    max_retry: 3,
    created_by: 'operator_a',
    raw_input: { orderId: 'BIZ20240101004', status: 'CANCELLED' },
    final_conclusion: { result: 'success', timestamp: '2024-01-01T12:00:00Z' }
  }
];

async function initSampleData() {
  console.log('开始初始化样例数据...');
  
  for (const data of sampleData) {
    const id = uuidv4();
    try {
      await runAsync(
        `INSERT INTO compensation_records 
         (id, approval_no, business_order_no, callback_event, compensation_action, status, 
          retry_count, max_retry, created_by, raw_input, error_message, final_conclusion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.approval_no,
          data.business_order_no,
          data.callback_event,
          data.compensation_action,
          data.status,
          data.retry_count || 0,
          data.max_retry || 3,
          data.created_by,
          JSON.stringify(data.raw_input),
          data.error_message || null,
          data.final_conclusion ? JSON.stringify(data.final_conclusion) : null
        ]
      );
      console.log(`✓ 已插入: ${data.approval_no} - ${data.callback_event}`);
    } catch (err) {
      if (err.message.includes('UNIQUE constraint')) {
        console.log(`- 已存在，跳过: ${data.approval_no} - ${data.callback_event}`);
      } else {
        console.error(`✗ 插入失败: ${err.message}`);
      }
    }
  }
  
  console.log('\n样例数据初始化完成!');
  console.log('\n数据概览:');
  console.log('  - PENDING: 等待处理 (AP20240101001)');
  console.log('  - FAILED: 已失败可重试 (AP20240101002)');
  console.log('  - NEED_MANUAL_CONFIRM: 需要人工确认 (AP20240101003)');
  console.log('  - SUCCESS: 补偿成功 (AP20240101004)');
  
  db.close();
}

initSampleData().catch(console.error);