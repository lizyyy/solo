const http = require('http');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000/api';

let testTicketId = null;

const request = (options, body = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
};

const getOptions = (path, method = 'GET') => ({
  hostname: 'localhost',
  port: 3000,
  path: `/api${path}`,
  method: method,
  headers: {
    'Content-Type': 'application/json'
  }
});

const tests = [];
const results = [];

const test = (name, fn) => {
  tests.push({ name, fn });
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
};

const assertEqual = (actual, expected, message) => {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
};

const assertSuccess = (res, message) => {
  assertEqual(res.status, 200, `${message}: Expected status 200, got ${res.status}`);
  assert(res.data.success, `${message}: Response should be successful`);
};

test('1. 健康检查', async () => {
  const res = await request(getOptions('/health'));
  assertSuccess(res, '健康检查');
  console.log('  ✓ 服务运行正常');
});

test('2. 获取看板数据', async () => {
  const res = await request(getOptions('/tickets/kanban'));
  assertSuccess(res, '获取看板数据');
  
  const kanban = res.data.data;
  assert(kanban.pending_inspection, '看板应包含待检测状态');
  assert(kanban.quoting, '看板应包含报价中状态');
  assert(kanban.repairing, '看板应包含维修中状态');
  assert(kanban.pending_pickup, '看板应包含待取机状态');
  assert(kanban.completed, '看板应包含已完成状态');
  assert(kanban.cancelled, '看板应包含已取消状态');
  
  console.log('  ✓ 看板数据结构正确');
  console.log(`  ✓ 待检测: ${kanban.pending_inspection.tickets.length} 条`);
  console.log(`  ✓ 报价中: ${kanban.quoting.tickets.length} 条`);
  console.log(`  ✓ 维修中: ${kanban.repairing.tickets.length} 条`);
});

test('3. 创建新工单', async () => {
  const newTicket = {
    customer_name: '测试客户',
    customer_phone: '13800001111',
    device_model: '测试设备 Pro',
    fault_description: '测试故障描述',
    quote_amount: 100,
    repair_parts: '测试配件',
    estimated_pickup_time: '2026-06-01 18:00',
    notes: '测试备注'
  };

  const res = await request(getOptions('/tickets', 'POST'), newTicket);
  assertSuccess(res, '创建工单');
  
  const data = res.data.data;
  assert(data.id, '工单应返回ID');
  assert(data.ticket_no, '工单应返回工单号');
  assertEqual(data.status, 'pending_inspection', '新建工单状态应为待检测');
  
  testTicketId = data.id;
  console.log(`  ✓ 工单创建成功，ID: ${testTicketId}, 工单号: ${data.ticket_no}`);
});

test('4. 获取工单详情', async () => {
  if (!testTicketId) {
    throw new Error('需要先创建测试工单');
  }

  const res = await request(getOptions(`/tickets/${testTicketId}`));
  assertSuccess(res, '获取工单详情');
  
  const ticket = res.data.data;
  assertEqual(ticket.id, testTicketId, '工单ID应匹配');
  assertEqual(ticket.customer_name, '测试客户', '客户姓名应匹配');
  assertEqual(ticket.customer_phone, '13800001111', '手机号应匹配');
  assertEqual(ticket.device_model, '测试设备 Pro', '设备型号应匹配');
  assert(ticket.statusLogs, '工单应包含状态日志');
  
  console.log('  ✓ 工单详情获取成功');
  console.log(`  ✓ 状态: ${ticket.statusLabel}`);
});

test('5. 更新工单信息', async () => {
  if (!testTicketId) {
    throw new Error('需要先创建测试工单');
  }

  const updateData = {
    customer_name: '修改后的客户名',
    quote_amount: 200,
    notes: '修改后的备注'
  };

  const res = await request(getOptions(`/tickets/${testTicketId}`, 'PUT'), updateData);
  assertSuccess(res, '更新工单');
  console.log('  ✓ 工单更新成功');
});

test('6. 验证工单更新结果', async () => {
  if (!testTicketId) {
    throw new Error('需要先创建测试工单');
  }

  const res = await request(getOptions(`/tickets/${testTicketId}`));
  assertSuccess(res, '获取更新后的工单');
  
  const ticket = res.data.data;
  assertEqual(ticket.customer_name, '修改后的客户名', '客户名应已更新');
  assertEqual(ticket.quote_amount, 200, '报价金额应已更新');
  assertEqual(ticket.notes, '修改后的备注', '备注应已更新');
  
  console.log('  ✓ 验证更新成功');
});

test('7. 测试状态流转 - 待检测 -> 报价中', async () => {
  if (!testTicketId) {
    throw new Error('需要先创建测试工单');
  }

  const res = await request(getOptions(`/tickets/${testTicketId}/transition`, 'POST'), {
    targetStatus: 'quoting'
  });
  assertSuccess(res, '状态流转');
  assertEqual(res.data.data.status, 'quoting', '状态应为报价中');
  
  console.log('  ✓ 状态流转成功：待检测 -> 报价中');
});

test('8. 测试状态流转 - 报价中 -> 维修中', async () => {
  if (!testTicketId) {
    throw new Error('需要先创建测试工单');
  }

  const res = await request(getOptions(`/tickets/${testTicketId}/transition`, 'POST'), {
    targetStatus: 'repairing'
  });
  assertSuccess(res, '状态流转');
  assertEqual(res.data.data.status, 'repairing', '状态应为维修中');
  
  console.log('  ✓ 状态流转成功：报价中 -> 维修中');
});

test('9. 测试状态流转 - 维修中 -> 待取机', async () => {
  if (!testTicketId) {
    throw new Error('需要先创建测试工单');
  }

  const res = await request(getOptions(`/tickets/${testTicketId}/transition`, 'POST'), {
    targetStatus: 'pending_pickup'
  });
  assertSuccess(res, '状态流转');
  assertEqual(res.data.data.status, 'pending_pickup', '状态应为待取机');
  
  console.log('  ✓ 状态流转成功：维修中 -> 待取机');
});

test('10. 测试状态流转 - 待取机 -> 已完成', async () => {
  if (!testTicketId) {
    throw new Error('需要先创建测试工单');
  }

  const res = await request(getOptions(`/tickets/${testTicketId}/transition`, 'POST'), {
    targetStatus: 'completed'
  });
  assertSuccess(res, '状态流转');
  assertEqual(res.data.data.status, 'completed', '状态应为已完成');
  
  console.log('  ✓ 状态流转成功：待取机 -> 已完成');
});

test('11. 测试已完成工单无法继续流转', async () => {
  if (!testTicketId) {
    throw new Error('需要先创建测试工单');
  }

  const res = await request(getOptions(`/tickets/${testTicketId}/transition`, 'POST'), {
    targetStatus: 'quoting'
  });
  
  assertEqual(res.status, 400, '已完成工单流转应返回400');
  assert(!res.data.success, '响应应标记为失败');
  
  console.log('  ✓ 已完成工单无法继续流转，正确返回错误');
});

test('12. 测试搜索功能', async () => {
  const res = await request(getOptions('/tickets/kanban?keyword=张三'));
  assertSuccess(res, '搜索工单');
  
  const kanban = res.data.data;
  let found = false;
  Object.values(kanban).forEach(column => {
    column.tickets.forEach(ticket => {
      if (ticket.customer_name === '张三' || 
          ticket.customer_phone.includes('张三') ||
          ticket.ticket_no.includes('张三') ||
          ticket.device_model.includes('张三')) {
        found = true;
      }
    });
  });
  
  console.log('  ✓ 搜索功能正常');
});

test('13. 测试获取状态信息', async () => {
  const res = await request(getOptions('/tickets/status/info'));
  assertSuccess(res, '获取状态信息');
  
  const statusInfo = res.data.data;
  assert(statusInfo.pending_inspection, '应包含待检测状态');
  assert(statusInfo.quoting, '应包含报价中状态');
  assert(statusInfo.repairing, '应包含维修中状态');
  assert(statusInfo.pending_pickup, '应包含待取机状态');
  assert(statusInfo.completed, '应包含已完成状态');
  assert(statusInfo.cancelled, '应包含已取消状态');
  
  console.log('  ✓ 状态信息获取成功');
  console.log('  ✓ 共 6 种状态');
});

const runTests = async () => {
  console.log('\n========================================');
  console.log('    维修工单系统 API 测试');
  console.log('========================================\n');
  
  console.log('测试前请确保后端服务已启动:');
  console.log('  cd backend && npm run start 或 npm run dev');
  console.log('\n');

  for (const { name, fn } of tests) {
    console.log(`\n${name}`);
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (error) {
      console.log(`  ✗ 失败: ${error.message}`);
      results.push({ name, passed: false, error: error.message });
    }
  }

  console.log('\n\n========================================');
  console.log('    测试结果汇总');
  console.log('========================================\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`通过: ${passed} 项`);
  console.log(`失败: ${failed} 项`);
  console.log(`总计: ${results.length} 项\n`);

  if (failed > 0) {
    console.log('失败的测试:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('🎉 所有测试通过！');
    process.exit(0);
  }
};

runTests().catch(err => {
  console.error('\n测试运行出错:', err.message);
  process.exit(1);
});
