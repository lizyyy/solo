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
  console.log('  景区索道风速停运API - 异常触发路径');
  console.log('========================================\n');

  console.log('步骤 1: 检查服务是否运行...');
  try {
    const health = await request('GET', '/health');
    console.log('✓ 服务运行正常');
  } catch (e) {
    console.error('✗ 服务未启动，请先运行: npm start');
    console.error('错误信息:', e.message);
    process.exit(1);
  }

  await sleep(300);

  console.log('\n异常场景 1: 记录无效的负风速值');
  console.log('----------------------------------------');
  const invalidWind = await request('POST', '/api/wind-speed/record', {
    wind_speed: -5
  });
  console.log('请求: POST /api/wind-speed/record { wind_speed: -5 }');
  console.log('响应状态码:', invalidWind.status);
  console.log('响应内容:', JSON.stringify(invalidWind.data, null, 2));
  console.log('✓ 预期错误: WIND_SPEED_INVALID - 风速不能为负数');

  await sleep(300);

  console.log('\n异常场景 2: 风速正常时尝试批量取消班次');
  console.log('----------------------------------------');
  await request('POST', '/api/wind-speed/record', { wind_speed: 5 });
  const cancelNormal = await request('POST', '/api/schedule/cancel-all-wind');
  console.log('请求: POST /api/schedule/cancel-all-wind（风速正常时）');
  console.log('响应状态码:', cancelNormal.status);
  console.log('响应内容:', JSON.stringify(cancelNormal.data, null, 2));
  console.log('✓ 预期错误: WIND_SPEED_EXCEEDED - 当前风速未达到停运标准');

  await sleep(300);

  console.log('\n异常场景 3: 尝试获取不存在的班次');
  console.log('----------------------------------------');
  const nonExistentSchedule = await request('GET', '/api/schedule/non-existent-id');
  console.log('请求: GET /api/schedule/non-existent-id');
  console.log('响应状态码:', nonExistentSchedule.status);
  console.log('响应内容:', JSON.stringify(nonExistentSchedule.data, null, 2));
  console.log('✓ 预期错误: SCHEDULE_NOT_FOUND - 班次不存在');

  await sleep(300);

  console.log('\n异常场景 4: 尝试获取不存在的票务');
  console.log('----------------------------------------');
  const nonExistentTicket = await request('GET', '/api/ticket/non-existent-id');
  console.log('请求: GET /api/ticket/non-existent-id');
  console.log('响应状态码:', nonExistentTicket.status);
  console.log('响应内容:', JSON.stringify(nonExistentTicket.data, null, 2));
  console.log('✓ 预期错误: TICKET_NOT_FOUND - 票务不存在');

  await sleep(300);

  console.log('\n异常场景 5: 风速超标后，测试票务状态流转异常');
  console.log('----------------------------------------');
  
  console.log('5.1 先创建一个正常的班次...');
  const schedule = await request('POST', '/api/schedule', {
    route: '测试线路',
    departure_time: '2026-05-13 10:00:00',
    arrival_time: '2026-05-13 10:15:00'
  });
  const scheduleId = schedule.data.data.id;

  console.log('5.2 购买一张票...');
  const ticket = await request('POST', '/api/ticket', {
    schedule_id: scheduleId,
    passenger_name: '测试游客',
    price: 100
  });
  const ticketId = ticket.data.data.id;
  console.log('票务ID:', ticketId);

  console.log('5.3 记录超标风速...');
  await request('POST', '/api/wind-speed/record', { wind_speed: 30 });

  console.log('5.4 取消班次（票务会自动锁定）...');
  await request('POST', '/api/schedule/cancel-all-wind');

  console.log('5.5 异常场景：尝试直接退票（未开启退款通道）');
  const directRefund = await request('POST', `/api/ticket/${ticketId}/refund`, {
    refund_amount: 100
  });
  console.log('请求: POST /api/ticket/{id}/refund（票务状态: LOCKED）');
  console.log('响应状态码:', directRefund.status);
  console.log('响应内容:', JSON.stringify(directRefund.data, null, 2));
  console.log('✓ 预期错误: TICKET_REFUND_NOT_ALLOWED - 票务不处于可退款状态');

  await sleep(300);

  console.log('\n异常场景 6: 尝试设置无效的班次状态');
  console.log('----------------------------------------');
  const invalidStatus = await request('PUT', `/api/schedule/${scheduleId}/status`, {
    status: 'INVALID_STATUS'
  });
  console.log('请求: PUT /api/schedule/{id}/status { status: "INVALID_STATUS" }');
  console.log('响应状态码:', invalidStatus.status);
  console.log('响应内容:', JSON.stringify(invalidStatus.data, null, 2));
  console.log('✓ 预期错误: INVALID_PARAMETER - 无效的状态值');

  await sleep(300);

  console.log('\n异常场景 7: 尝试使用已取消的班次购票');
  console.log('----------------------------------------');
  const buyCancelled = await request('POST', '/api/ticket', {
    schedule_id: scheduleId,
    passenger_name: '新游客',
    price: 100
  });
  console.log('请求: POST /api/ticket（班次状态: CANCELLED）');
  console.log('响应状态码:', buyCancelled.status);
  console.log('响应内容:', JSON.stringify(buyCancelled.data, null, 2));
  console.log('✓ 预期错误: SCHEDULE_ALREADY_CANCELLED - 该班次已取消，无法购票');

  await sleep(300);

  console.log('\n异常场景 8: 尝试执行非法的状态转换');
  console.log('----------------------------------------');
  console.log('先完成正确的退票流程...');
  await request('PUT', `/api/ticket/${ticketId}/refundable`);
  await request('POST', `/api/ticket/${ticketId}/refund`, { refund_amount: 100 });

  console.log('然后尝试对已退票的票务进行操作...');
  const modifyRefunded = await request('PUT', `/api/ticket/${ticketId}/refundable`);
  console.log('请求: PUT /api/ticket/{id}/refundable（票务状态: REFUNDED）');
  console.log('响应状态码:', modifyRefunded.status);
  console.log('响应内容:', JSON.stringify(modifyRefunded.data, null, 2));
  console.log('✓ 预期错误: TICKET_ALREADY_REFUNDED - 该票务已退票，无法修改状态');

  await sleep(300);

  console.log('\n异常场景 9: 尝试退款金额大于票价');
  console.log('----------------------------------------');
  
  console.log('先创建新班次和票务...');
  const schedule2 = await request('POST', '/api/schedule', {
    route: '测试线路2',
    departure_time: '2026-05-14 10:00:00',
    arrival_time: '2026-05-14 10:15:00'
  });
  const scheduleId2 = schedule2.data.data.id;

  const ticket2 = await request('POST', '/api/ticket', {
    schedule_id: scheduleId2,
    passenger_name: '测试游客2',
    price: 80
  });
  const ticketId2 = ticket2.data.data.id;

  console.log('先让票务进入可退款状态...');
  await request('POST', '/api/wind-speed/record', { wind_speed: 35 });
  await request('POST', `/api/schedule/${scheduleId2}/cancel-wind`);
  await request('PUT', `/api/ticket/${ticketId2}/refundable`);

  console.log('尝试退款 200 元（票价仅 80 元）...');
  const overRefund = await request('POST', `/api/ticket/${ticketId2}/refund`, {
    refund_amount: 200
  });
  console.log('请求: POST /api/ticket/{id}/refund { refund_amount: 200 }（票价: 80）');
  console.log('响应状态码:', overRefund.status);
  console.log('响应内容:', JSON.stringify(overRefund.data, null, 2));
  console.log('✓ 预期错误: INVALID_PARAMETER - 退款金额不能大于票价');

  await sleep(300);

  console.log('\n异常场景 10: 访问不存在的接口');
  console.log('----------------------------------------');
  const notFound = await request('GET', '/api/non-existent-endpoint');
  console.log('请求: GET /api/non-existent-endpoint');
  console.log('响应状态码:', notFound.status);
  console.log('响应内容:', JSON.stringify(notFound.data, null, 2));
  console.log('✓ 预期错误: 404 NOT_FOUND - 接口不存在');

  console.log('\n========================================');
  console.log('  异常触发路径完成！');
  console.log('========================================');
  console.log('\n触发的异常场景总结：');
  console.log('1. 风速值无效（负数）');
  console.log('2. 风速正常时尝试取消班次');
  console.log('3. 获取不存在的班次');
  console.log('4. 获取不存在的票务');
  console.log('5. 未开启退款通道时直接退票');
  console.log('6. 设置无效的状态值');
  console.log('7. 使用已取消的班次购票');
  console.log('8. 修改已退票的票务');
  console.log('9. 退款金额大于票价');
  console.log('10. 访问不存在的接口');
  console.log('\n========================================\n');
}

main().catch(console.error);
