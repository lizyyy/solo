const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testCompleteWorkflow() {
  console.log('\n=== 测试1: 完整救援流程 ===');
  
  console.log('\n1. 创建报警...');
  let res = await request('/api/tickets', 'POST', {
    building: 'A栋',
    elevator: '1号梯',
    reporterName: '张三',
    reporterPhone: '13800138001',
    trappedCount: 3,
    description: '电梯卡在5楼，门打不开'
  });
  console.log(`  状态: ${res.status}`, JSON.stringify(res.data, null, 2));
  
  const ticketId = res.data.ticket.id;
  
  console.log('\n2. 派单给维保人员...');
  res = await request(`/api/tickets/${ticketId}/dispatch`, 'POST', {
    maintenancePerson: '李维保'
  });
  console.log(`  状态: ${res.status}`, JSON.stringify(res.data, null, 2));
  
  console.log('\n3. 记录到场时间...');
  res = await request(`/api/tickets/${ticketId}/arrive`, 'POST');
  console.log(`  状态: ${res.status}`, JSON.stringify(res.data, null, 2));
  
  console.log('\n4. 记录解救时间...');
  res = await request(`/api/tickets/${ticketId}/rescue`, 'POST');
  console.log(`  状态: ${res.status}`, JSON.stringify(res.data, null, 2));
  
  console.log('\n5. 关闭工单并填写复盘...');
  res = await request(`/api/tickets/${ticketId}/close`, 'POST', {
    issues: ['电梯老化', '维护周期过长'],
    summary: '电梯因传感器故障卡在5楼，3人被困约15分钟，已成功解救',
    improvementMeasures: ['增加巡检频率', '更换传感器', '建立预警机制'],
    reviewer: '王主管'
  });
  console.log(`  状态: ${res.status}`, JSON.stringify(res.data, null, 2));

  return ticketId;
}

async function testDuplicateReport() {
  console.log('\n\n=== 测试2: 重复报警合并 ===');
  
  console.log('\n1. 创建第一个报警...');
  let res = await request('/api/tickets', 'POST', {
    building: 'B栋',
    elevator: '2号梯',
    reporterName: '李四',
    reporterPhone: '13800138002',
    trappedCount: 2,
    description: '电梯停在3楼'
  });
  console.log(`  状态: ${res.status}, 合并: ${res.data.merged}`);
  console.log(`  工单ID: ${res.data.ticket.id}`);
  
  const originalTicketId = res.data.ticket.id;
  
  console.log('\n2. 同一电梯5分钟后再次报警（应合并）...');
  res = await request('/api/tickets', 'POST', {
    building: 'B栋',
    elevator: '2号梯',
    reporterName: '王五',
    reporterPhone: '13800138003',
    trappedCount: 2,
    description: '听到有人呼救'
  });
  console.log(`  状态: ${res.status}, 合并: ${res.data.merged}`);
  console.log(`  原工单ID: ${res.data.originalTicketId}`);
  console.log(`  合并次数: ${res.data.ticket.mergeCount}`);
  
  return originalTicketId;
}

async function testTimeoutResponse() {
  console.log('\n\n=== 测试3: 超时响应模拟 ===');
  
  console.log('\n1. 创建报警（模拟超时）...');
  let res = await request('/api/tickets', 'POST', {
    building: 'C栋',
    elevator: '3号梯',
    reporterName: '赵六',
    reporterPhone: '13800138004',
    trappedCount: 1,
    description: '电梯突然停止运行'
  });
  console.log(`  状态: ${res.status}`);
  console.log(`  工单ID: ${res.data.ticket.id}`);
  console.log(`  超时状态: ${res.data.ticket.isTimeout}`);

  const ticketId = res.data.ticket.id;
  
  console.log('\n2. 查询统计信息，查看超时工单...');
  res = await request('/api/statistics', 'GET');
  console.log(`  状态: ${res.status}`);
  console.log(`  未完成工单: ${res.data.openTickets.length}`);
  console.log(`  超时工单: ${res.data.timeoutTickets.length}`);
  console.log(`  楼栋统计:`, JSON.stringify(res.data.buildings, null, 2));
  console.log(`  电梯统计:`, JSON.stringify(res.data.elevators, null, 2));

  return ticketId;
}

async function testStatusRules() {
  console.log('\n\n=== 测试4: 状态规则验证 ===');
  
  console.log('\n1. 创建报警...');
  let res = await request('/api/tickets', 'POST', {
    building: 'D栋',
    elevator: '1号梯',
    reporterName: '钱七',
    reporterPhone: '13800138005',
    trappedCount: 1
  });
  const ticketId = res.data.ticket.id;
  console.log(`  工单ID: ${ticketId}`);
  
  console.log('\n2. 尝试未派单直接记录到场（应失败）...');
  res = await request(`/api/tickets/${ticketId}/arrive`, 'POST');
  console.log(`  状态: ${res.status}`, JSON.stringify(res.data));
  
  console.log('\n3. 先派单...');
  res = await request(`/api/tickets/${ticketId}/dispatch`, 'POST', {
    maintenancePerson: '陈维保'
  });
  
  console.log('\n4. 记录到场...');
  res = await request(`/api/tickets/${ticketId}/arrive`, 'POST');
  
  console.log('\n5. 记录解救...');
  res = await request(`/api/tickets/${ticketId}/rescue`, 'POST');
  
  console.log('\n6. 关闭工单...');
  res = await request(`/api/tickets/${ticketId}/close`, 'POST', {
    issues: ['测试'],
    summary: '测试关闭',
    improvementMeasures: [],
    reviewer: '测试员'
  });
  
  console.log('\n7. 尝试已关闭后再次派单（应失败）...');
  res = await request(`/api/tickets/${ticketId}/dispatch`, 'POST', {
    maintenancePerson: '另一个人'
  });
  console.log(`  状态: ${res.status}`, JSON.stringify(res.data));
  
  console.log('\n8. 尝试同一电梯创建新工单（旧工单已关闭，应创建新工单）...');
  res = await request('/api/tickets', 'POST', {
    building: 'D栋',
    elevator: '1号梯',
    reporterName: '孙八',
    reporterPhone: '13800138006',
    trappedCount: 1
  });
  console.log(`  状态: ${res.status}, 合并: ${res.data.merged}`);
  
  console.log('\n9. 验证同一电梯不能同时有多个未处理工单...');
  res = await request('/api/tickets', 'POST', {
    building: 'D栋',
    elevator: '1号梯',
    reporterName: '周九',
    reporterPhone: '13800138007',
    trappedCount: 1
  });
  console.log(`  状态: ${res.status}, 合并: ${res.data.merged}`);
  if (res.data.merged) {
    console.log('  ✓ 成功阻止了同一电梯同时存在多个未处理工单');
  }
}

async function testStatistics() {
  console.log('\n\n=== 测试5: 查询统计信息 ===');
  
  console.log('\n1. 查询所有工单...');
  let res = await request('/api/tickets', 'GET');
  console.log(`  总工单数量: ${res.data.tickets.length}`);
  res.data.tickets.forEach((t, i) => {
    console.log(`  ${i+1}. ${t.building}-${t.elevator}: ${t.status}, 响应时间: ${t.responseTime}秒`);
  });
  
  console.log('\n2. 查询统计数据...');
  res = await request('/api/statistics', 'GET');
  console.log(`  总工单: ${res.data.totalTickets}`);
  console.log(`  未完成: ${res.data.openTickets.length}`);
  console.log(`  超时: ${res.data.timeoutTickets.length}`);
  console.log(`  涉及楼栋: ${res.data.buildings.map(b => b.building).join(', ')}`);
  console.log(`  涉及电梯: ${res.data.elevators.map(e => `${e.building}-${e.elevator}`).join(', ')}`);
  
  console.log('\n3. 查询单个工单详情...');
  if (res.data.openTickets.length > 0) {
    const ticketId = res.data.openTickets[0].id;
    res = await request(`/api/tickets/${ticketId}`, 'GET');
    console.log(`  工单详情:`, JSON.stringify(res.data.ticket, null, 2));
  }
}

async function main() {
  console.log('========================================');
  console.log('  物业电梯困人响应API - 功能测试');
  console.log('========================================');

  try {
    await testCompleteWorkflow();
    await testDuplicateReport();
    await testTimeoutResponse();
    await testStatusRules();
    await testStatistics();
    
    console.log('\n\n========================================');
    console.log('  所有测试完成！');
    console.log('========================================');
    console.log('\n示例curl命令:');
    console.log('\n1. 创建报警:');
    console.log(`curl -X POST http://localhost:3000/api/tickets \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"building":"A栋","elevator":"1号梯","reporterName":"张三","reporterPhone":"13800138000","trappedCount":3,"description":"电梯卡在5楼"}'`);
    
    console.log('\n2. 派单:');
    console.log(`curl -X POST http://localhost:3000/api/tickets/{工单ID}/dispatch \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"maintenancePerson":"李维保"}'`);
    
    console.log('\n3. 记录到场:');
    console.log(`curl -X POST http://localhost:3000/api/tickets/{工单ID}/arrive`);
    
    console.log('\n4. 记录解救:');
    console.log(`curl -X POST http://localhost:3000/api/tickets/{工单ID}/rescue`);
    
    console.log('\n5. 关闭工单:');
    console.log(`curl -X POST http://localhost:3000/api/tickets/{工单ID}/close \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"issues":["电梯老化"],"summary":"成功解救","improvementMeasures":["增加巡检"],"reviewer":"王主管"}'`);
    
    console.log('\n6. 查询统计:');
    console.log(`curl http://localhost:3000/api/statistics`);
  } catch (error) {
    console.error('测试失败:', error.message);
    console.log('\n请确保服务器正在运行: npm start');
  }
}

main();
