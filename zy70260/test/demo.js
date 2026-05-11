const http = require('http');

const BASE_URL = 'http://localhost:3000';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    
    const options = {
      method,
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
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

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function main() {
  console.log('\n========================================');
  console.log('  景区索道风速停运API - 正常演示路径');
  console.log('========================================\n');

  console.log('步骤 1: 检查服务是否运行...');
  try {
    const health = await request('GET', '/health');
    console.log('✓ 服务运行正常:', JSON.stringify(health.data, null, 2));
  } catch (e) {
    console.error('✗ 服务未启动，请先运行: npm start');
    console.error('错误信息:', e.message);
    process.exit(1);
  }

  await sleep(500);

  console.log('\n步骤 2: 记录正常风速数据（5 m/s）...');
  const wind1 = await request('POST', '/api/wind-speed/record', {
    wind_speed: 5
  });
  console.log('✓ 风速记录成功:', JSON.stringify(wind1.data, null, 2));

  await sleep(500);

  console.log('\n步骤 3: 获取当前风速状态...');
  const status1 = await request('GET', '/api/wind-speed/status');
  console.log('✓ 风速状态:', JSON.stringify(status1.data, null, 2));

  await sleep(500);

  console.log('\n步骤 4: 创建索道班次（泰山-南天门 8:00 发车）...');
  const schedule1 = await request('POST', '/api/schedule', {
    route: '泰山-南天门',
    departure_time: '2026-05-12 08:00:00',
    arrival_time: '2026-05-12 08:15:00',
    capacity: 50
  });
  console.log('✓ 班次创建成功:', JSON.stringify(schedule1.data, null, 2));
  const scheduleId = schedule1.data.data.id;

  await sleep(500);

  console.log('\n步骤 5: 游客购票（3名游客购买同一班次）...');
  const ticket1 = await request('POST', '/api/ticket', {
    schedule_id: scheduleId,
    passenger_name: '张三',
    passenger_phone: '13800138001',
    price: 120
  });
  console.log('✓ 游客1购票成功:', JSON.stringify(ticket1.data, null, 2));

  const ticket2 = await request('POST', '/api/ticket', {
    schedule_id: scheduleId,
    passenger_name: '李四',
    passenger_phone: '13800138002',
    price: 120
  });
  console.log('✓ 游客2购票成功:', JSON.stringify(ticket2.data, null, 2));

  const ticket3 = await request('POST', '/api/ticket', {
    schedule_id: scheduleId,
    passenger_name: '王五',
    passenger_phone: '13800138003',
    price: 120
  });
  console.log('✓ 游客3购票成功:', JSON.stringify(ticket3.data, null, 2));
  const ticketIds = [
    ticket1.data.data.id,
    ticket2.data.data.id,
    ticket3.data.data.id
  ];

  await sleep(500);

  console.log('\n步骤 6: 查看班次票务情况...');
  const tickets = await request('GET', `/api/ticket?schedule_id=${scheduleId}`);
  console.log('✓ 票务列表:', JSON.stringify(tickets.data, null, 2));

  await sleep(500);

  console.log('\n步骤 7: 风速突然升高到 18 m/s（预警阈值）...');
  const wind2 = await request('POST', '/api/wind-speed/record', {
    wind_speed: 18
  });
  console.log('✓ 风速记录成功（预警状态）:', JSON.stringify(wind2.data, null, 2));

  await sleep(500);

  console.log('\n步骤 8: 获取当前风速状态（预警）...');
  const status2 = await request('GET', '/api/wind-speed/status');
  console.log('✓ 风速状态（预警）:', JSON.stringify(status2.data, null, 2));

  await sleep(500);

  console.log('\n步骤 9: 风速继续升高到 28 m/s（超过停运阈值 25 m/s）...');
  const wind3 = await request('POST', '/api/wind-speed/record', {
    wind_speed: 28
  });
  console.log('✓ 风速记录成功（停运状态）:', JSON.stringify(wind3.data, null, 2));

  await sleep(500);

  console.log('\n步骤 10: 获取当前风速状态（停运）...');
  const status3 = await request('GET', '/api/wind-speed/status');
  console.log('✓ 风速状态（停运）:', JSON.stringify(status3.data, null, 2));

  await sleep(500);

  console.log('\n步骤 11: 批量取消所有受影响的班次（因风速停运）...');
  const cancelResult = await request('POST', '/api/schedule/cancel-all-wind');
  console.log('✓ 批量取消结果:', JSON.stringify(cancelResult.data, null, 2));

  await sleep(500);

  console.log('\n步骤 12: 查看班次状态变化...');
  const scheduleAfter = await request('GET', `/api/schedule/${scheduleId}`);
  console.log('✓ 班次状态（已取消）:', JSON.stringify(scheduleAfter.data, null, 2));

  await sleep(500);

  console.log('\n步骤 13: 查看票务状态变化（已自动锁定）...');
  const ticketsAfter = await request('GET', `/api/ticket?schedule_id=${scheduleId}`);
  console.log('✓ 票务状态（已锁定）:', JSON.stringify(ticketsAfter.data, null, 2));

  await sleep(500);

  console.log('\n步骤 14: 为游客1开启退款通道...');
  const refundable1 = await request('PUT', `/api/ticket/${ticketIds[0]}/refundable`);
  console.log('✓ 开启退款通道成功:', JSON.stringify(refundable1.data, null, 2));

  await sleep(500);

  console.log('\n步骤 15: 游客1申请全额退款（因停运）...');
  const refund1 = await request('POST', `/api/ticket/${ticketIds[0]}/refund`, {
    refund_amount: 120
  });
  console.log('✓ 退票成功:', JSON.stringify(refund1.data, null, 2));

  await sleep(500);

  console.log('\n步骤 16: 查看退票规则说明...');
  const rules = await request('GET', '/api/ticket/rules');
  console.log('✓ 退票规则:', JSON.stringify(rules.data, null, 2));

  await sleep(500);

  console.log('\n步骤 17: 查看历史变更记录...');
  const history = await request('GET', '/api/history?limit=30');
  console.log('✓ 历史记录数量:', history.data.data.length);
  console.log('✓ 历史记录预览（前5条）:');
  history.data.data.slice(0, 5).forEach((record, index) => {
    console.log(`  ${index + 1}. [${record.created_at}] ${record.entity_type} - ${record.operation}`);
    if (record.before_value) {
      console.log(`     变更前: ${JSON.stringify(record.before_value)}`);
    }
    if (record.after_value) {
      console.log(`     变更后: ${JSON.stringify(record.after_value)}`);
    }
  });

  await sleep(500);

  console.log('\n========================================');
  console.log('  正常演示路径完成！');
  console.log('========================================');
  console.log('\n关键流程总结：');
  console.log('1. 风速: 5m/s (正常) → 18m/s (预警) → 28m/s (停运)');
  console.log('2. 班次: PLANNED (计划) → CANCELLED (取消)');
  console.log('3. 票务: PURCHASED (已购票) → LOCKED (锁定) → REFUNDABLE (可退款) → REFUNDED (已退票)');
  console.log('4. 历史记录: 所有状态变更均已记录，可追溯');
  console.log('\n========================================\n');
}

main().catch(console.error);
