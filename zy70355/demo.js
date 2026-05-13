const http = require('http');

const BASE_URL = 'http://localhost:3000/api/tickets';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: data
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function post(path, body) {
  const url = new URL(BASE_URL + path);
  return request({
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(body))
    }
  }, body);
}

function get(path) {
  const url = new URL(BASE_URL + path);
  return request({
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: 'GET'
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log('='.repeat(60));
}

function logStep(step, desc) {
  console.log(`\n[Step ${step}] ${desc}`);
  console.log('-'.repeat(40));
}

async function runDemo() {
  console.log('开始演示工单 SLA 暂停 API');
  console.log('等待服务器启动...');
  await delay(2000);

  logSection('场景 1: 正常关闭的技术支持工单');
  
  logStep(1, '创建技术支持工单 (高优先级 - 8小时 SLA)');
  let res = await post('/', {
    title: '无法登录系统',
    type: 'technical_support',
    priority: 'high',
    customerId: 'C001',
    description: '用户反馈无法登录后台管理系统'
  });
  let techTicket = res.data;
  console.log(`工单ID: ${techTicket.id}`);
  console.log(`优先级: ${techTicket.priority}, SLA: 8小时`);

  logStep(2, '开始处理');
  res = await post(`/${techTicket.id}/start`, { assignee: '张三' });
  console.log(`处理人: ${res.data.assignee}`);
  console.log(`状态: ${res.data.status}`);

  logStep(3, '等待片刻模拟处理时间');
  await delay(100);

  logStep(4, '关闭工单');
  res = await post(`/${techTicket.id}/close`, {});
  console.log(`关闭时间: ${res.data.closedAt}`);
  console.log(`是否超时: ${res.data.slaResult.isOvertime}`);
  console.log(`用时: ${res.data.slaResult.usedMinutes} 分钟`);
  console.log(`SLA限制: ${res.data.slaResult.totalMinutes} 分钟`);

  logStep(5, '查看时间线');
  res = await get(`/${techTicket.id}/timeline`);
  console.log('时间线:');
  res.data.timeline.forEach((event, idx) => {
    console.log(`  ${idx + 1}. [${event.time.slice(11, 19)}] ${event.event} - ${event.details}`);
  });

  logSection('场景 2: 客户等待暂停的投诉工单');
  
  logStep(1, '创建投诉工单 (紧急优先级 - 2小时 SLA)');
  res = await post('/', {
    title: '投诉: 订单未按时送达',
    type: 'complaint',
    priority: 'critical',
    customerId: 'C002',
    description: '客户投诉订单承诺今天送达但未收到'
  });
  let complaintTicket = res.data;
  console.log(`工单ID: ${complaintTicket.id}`);

  logStep(2, '开始处理');
  res = await post(`/${complaintTicket.id}/start`, { assignee: '李四' });
  console.log(`处理人: ${res.data.assignee}`);

  logStep(3, '暂停 - 等待客户提供订单号 (客户等待)');
  res = await post(`/${complaintTicket.id}/pause`, {
    pauseType: 'customer_waiting',
    reason: '需要客户提供具体订单号以便查询物流状态'
  });
  console.log(`暂停类型: ${res.data.currentPauseType}`);
  console.log(`是否暂停: ${res.data.isPaused}`);

  logStep(4, '模拟等待客户回复 (暂停期间 SLA 不计入)');
  await delay(100);

  logStep(5, '客户提供信息，恢复计时');
  res = await post(`/${complaintTicket.id}/resume`, {});
  console.log(`是否暂停: ${res.data.isPaused}`);

  logStep(6, '处理完成，关闭工单');
  res = await post(`/${complaintTicket.id}/close`, {});
  console.log(`是否超时: ${res.data.slaResult.isOvertime}`);

  logStep(7, '查看详细时间线');
  res = await get(`/${complaintTicket.id}/timeline`);
  console.log('时间线:');
  res.data.timeline.forEach((event, idx) => {
    console.log(`  ${idx + 1}. [${event.time.slice(11, 19)}] ${event.event} - ${event.details}`);
  });

  logSection('场景 3: 测试暂停原因验证 (缺失原因不能生效)');
  
  logStep(1, '创建退款工单');
  res = await post('/', {
    title: '申请退款',
    type: 'refund',
    priority: 'medium',
    customerId: 'C003',
    description: '商品质量问题申请退款'
  });
  let refundTicket = res.data;
  console.log(`工单ID: ${refundTicket.id}`);

  logStep(2, '开始处理');
  await post(`/${refundTicket.id}/start`, { assignee: '王五' });

  logStep(3, '尝试不提供原因暂停 (应该失败)');
  res = await post(`/${refundTicket.id}/pause`, {
    pauseType: 'internal_waiting'
  });
  console.log(`状态码: ${res.statusCode}`);
  console.log(`错误: ${res.data?.error || '无错误'}`);

  logStep(4, '提供正确原因后成功暂停');
  res = await post(`/${refundTicket.id}/pause`, {
    pauseType: 'internal_waiting',
    reason: '需要财务部门审核退款申请'
  });
  console.log(`暂停成功: ${res.data.isPaused}`);

  logSection('场景 4: 测试幂等性 (重复暂停同一类型)');
  
  logStep(1, '再次以相同类型暂停 (应该幂等，不重复记录)');
  const eventsBefore = res.data.events.length;
  res = await post(`/${refundTicket.id}/pause`, {
    pauseType: 'internal_waiting',
    reason: '需要财务部门审核退款申请'
  });
  const eventsAfter = res.data.events.length;
  console.log(`事件数变化: ${eventsBefore} -> ${eventsAfter} (应该不变)`);
  console.log(`幂等验证: ${eventsBefore === eventsAfter ? '通过 ✓' : '失败 ✗'}`);

  logStep(2, '恢复并关闭');
  await post(`/${refundTicket.id}/resume`, {});
  res = await post(`/${refundTicket.id}/close`, {});
  console.log(`关闭成功: ${res.data.status === 'closed'}`);

  logSection('场景 5: 测试关闭后不能修改关键时间');
  
  logStep(1, '尝试修改已关闭工单的优先级 (应该失败)');
  res = await post(`/${refundTicket.id}/assign-priority`, {
    priority: 'high'
  });
  console.log(`状态码: ${res.statusCode} (应该是 409)`);
  console.log(`错误: ${res.data?.error || '无错误'}`);

  logStep(2, '尝试暂停已关闭工单 (应该失败)');
  res = await post(`/${refundTicket.id}/pause`, {
    pauseType: 'customer_waiting',
    reason: '测试'
  });
  console.log(`状态码: ${res.statusCode} (应该是 409)`);
  console.log(`错误: ${res.data?.error || '无错误'}`);

  logSection('场景 6: 申诉后重算 SLA');
  
  logStep(1, '模拟创建一个超时工单 (为了演示，先正常创建并关闭)');
  res = await post('/', {
    title: '超时处理的工单',
    type: 'technical_support',
    priority: 'critical',
    customerId: 'C004',
    description: '测试超时申诉'
  });
  let appealTicket = res.data;
  console.log(`工单ID: ${appealTicket.id}`);

  logStep(2, '开始处理');
  await post(`/${appealTicket.id}/start`, { assignee: '赵六' });
  
  logStep(3, '模拟内部处理延迟 (注意: 实际超时需要等待，这里演示申诉流程)');
  await delay(100);
  
  logStep(4, '关闭工单');
  res = await post(`/${appealTicket.id}/close`, {});
  const originalOvertime = res.data.slaResult.isOvertime;
  console.log(`原始超时状态: ${originalOvertime}`);

  logStep(5, '创建申诉 - 认为应该排除客户等待时间');
  res = await post(`/${appealTicket.id}/appeal`, {
    appealReason: '处理期间客户迟迟未回复，应排除客户等待时间',
    adjustPauseReason: '客户等待期间不应计入 SLA'
  });
  console.log(`申诉状态: ${res.data.appeal.status}`);

  logStep(6, '审批申诉 - 确认为客户等待');
  res = await post(`/${appealTicket.id}/approve-appeal`, {
    approvedPauseType: 'customer_waiting',
    approvedReason: '经查证，客户确实延迟回复，同意按客户等待调整'
  });
  console.log(`申诉审批后状态: ${res.data.appeal.status}`);
  console.log(`SLA 是否重算: ${res.data.slaResult.recalculated}`);
  console.log(`原超时: ${originalOvertime} -> 重算后: ${res.data.slaResult.isOvertime}`);

  logStep(7, '查看申诉后的完整时间线');
  res = await get(`/${appealTicket.id}/timeline`);
  console.log('时间线:');
  res.data.timeline.forEach((event, idx) => {
    console.log(`  ${idx + 1}. [${event.time.slice(11, 19)}] ${event.event}`);
    if (event.details) {
      console.log(`      ${event.details}`);
    }
  });

  logSection('场景 7: 统计报表 - 区分客户等待和内部延误');
  
  logStep(1, '获取所有工单统计');
  res = await get('/stats');
  console.log('统计摘要:');
  console.log(`  总工单数: ${res.data.summary.totalTickets}`);
  console.log(`  超时工单数: ${res.data.summary.overtimeTickets}`);
  console.log(`  超时率: ${res.data.summary.overtimeRate}`);
  console.log(`  总暂停时长: ${res.data.summary.totalPauseHours} 小时`);
  
  console.log('\n暂停类型明细:');
  Object.entries(res.data.pauseBreakdown).forEach(([key, value]) => {
    console.log(`  ${value.label}: ${value.minutes} 分钟 (${value.count} 次)`);
  });

  console.log('\n责任归属:');
  console.log(`  客户等待: ${res.data.responsibility.customerWaitingHours} 小时`);
  console.log(`  内部延误: ${res.data.responsibility.internalDelayHours} 小时`);

  logSection('演示完成！');
  console.log('\n所有场景演示完毕。');
  console.log('服务器仍在运行，可以使用 curl 命令继续测试。');
}

runDemo().catch(console.error);
