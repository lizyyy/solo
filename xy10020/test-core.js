const http = require('http');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmOThlMjIyZC04Zjk3LTQ5NmEtOTIxNC03Zjk5NGY5MDVhYzgiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3Nzg0NDEyNTksImV4cCI6MTc3ODUyNzY1OX0.MBPHDOntbSmJ-YFzyAMrXyojRtSKDE90T4c9sMpK960';

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testAll() {
  console.log('=== 核心功能验证 ===\n');

  console.log('1. 测试系统推送任务（之前因外键失败的核心功能）');
  const roomRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/live-rooms',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + TOKEN,
      'Content-Type': 'application/json'
    }
  }, { title: '系统推送测试房间' });
  const room = roomRes.body;
  console.log('   创建直播间:', roomRes.status, 'ID:', room.id);

  const taskRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/push-tasks',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + TOKEN,
      'Content-Type': 'application/json'
    }
  }, {
    taskType: 'room_announcement',
    liveRoomId: room.id,
    payload: { content: '系统公告测试消息 - senderId: system' }
  });
  console.log('   创建推送任务:', taskRes.status, 'ID:', taskRes.body.id);

  await new Promise(r => setTimeout(r, 2000));

  const taskCheckRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/push-tasks/' + taskRes.body.id,
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + TOKEN,
      'Content-Type': 'application/json'
    }
  });
  console.log('   任务状态:', taskCheckRes.body.status);
  if (taskCheckRes.body.status === 'completed') {
    console.log('   ✓ PASS: 系统推送任务成功完成（senderId="system" 无外键错误）');
  } else {
    console.log('   ✗ FAIL: 任务未完成:', taskCheckRes.body.errorMessage);
  }

  console.log('\n2. 测试幂等性');
  const IDEMPOTENCY_KEY = 'test-idempotency-' + Date.now();
  
  const baseOptions = {
    hostname: 'localhost',
    port: 3000,
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + TOKEN,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': IDEMPOTENCY_KEY
    }
  };

  const r1 = await request({ ...baseOptions, path: '/api/live-rooms' }, { title: '幂等测试' });
  console.log('   第一次请求:', r1.status, 'ID:', r1.body.id);
  
  const r2 = await request({ ...baseOptions, path: '/api/live-rooms' }, { title: '幂等测试' });
  console.log('   第二次请求（同幂等键）:', r2.status, 'ID:', r2.body.id);

  if (r1.body.id === r2.body.id) {
    console.log('   ✓ PASS: 幂等性生效，两次请求返回相同结果');
  } else {
    console.log('   ✗ FAIL: 幂等性未生效');
  }

  console.log('\n3. 测试乐观锁');
  const freshRoomRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/live-rooms',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + TOKEN,
      'Content-Type': 'application/json'
    }
  }, { title: '乐观锁测试房间' });
  const freshRoom = freshRoomRes.body;
  console.log('   创建新房间，版本:', freshRoom.version);

  const update1 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/live-rooms/' + freshRoom.id,
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + TOKEN,
      'Content-Type': 'application/json'
    }
  }, { title: '更新后的标题1', version: freshRoom.version });
  console.log('   第一次更新:', update1.status, '新版本:', update1.body?.version);

  const update2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/live-rooms/' + freshRoom.id,
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + TOKEN,
      'Content-Type': 'application/json'
    }
  }, { title: '更新后的标题2', version: freshRoom.version });
  console.log('   第二次更新（旧版本号）:', update2.status);

  if (update1.status === 200 && update2.status === 409) {
    console.log('   ✓ PASS: 乐观锁生效，使用旧版本号返回409冲突');
  } else {
    console.log('   ✗ FAIL: 乐观锁未生效');
  }

  console.log('\n4. 测试报告导出');
  const ONE_HOUR_AGO = Date.now() - 3600000;
  const NOW = Date.now();
  
  const reportRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/reports/summary?startTime=${ONE_HOUR_AGO}&endTime=${NOW}`,
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + TOKEN,
      'Content-Type': 'application/json'
    }
  });
  console.log('   报告摘要 - 总操作数:', reportRes.body.summary?.totalOperations);
  console.log('   报告摘要 - 完成任务数:', reportRes.body.summary?.completedTasks);
  if (reportRes.body.summary?.totalOperations > 0) {
    console.log('   ✓ PASS: 报告导出功能正常');
  } else {
    console.log('   ✗ FAIL: 报告数据为空');
  }

  console.log('\n=== 核心功能验证完成 ===');
}

testAll().catch(console.error);
