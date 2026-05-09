const http = require('http');

const BASE_URL = 'http://localhost:8080';

function httpRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsedData = data ? JSON.parse(data) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsedData
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
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
  const url = new URL(path, BASE_URL);
  return httpRequest({
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(body))
    }
  }, body);
}

function get(path) {
  const url = new URL(path, BASE_URL);
  return httpRequest({
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

function logResult(testName, expectedStatus, actualResult, passCondition = null) {
  const isPass = passCondition 
    ? passCondition(actualResult) 
    : actualResult.statusCode === expectedStatus;
  
  const status = isPass ? '✓ 通过' : '✗ 失败';
  console.log(`\n${status}: ${testName}`);
  console.log(`  期望状态码: ${expectedStatus}`);
  console.log(`  实际状态码: ${actualResult.statusCode}`);
  if (!isPass) {
    console.log(`  响应: ${JSON.stringify(actualResult.body, null, 2)}`);
  }
  return isPass;
}

async function runTests() {
  console.log('========================================');
  console.log('   冷链温控追溯 API 接口验证');
  console.log('========================================');
  console.log('\n开始执行测试...\n');

  const results = {
    pass: 0,
    fail: 0,
    total: 0
  };

  function addResult(isPass) {
    results.total++;
    if (isPass) {
      results.pass++;
    } else {
      results.fail++;
    }
  }

  console.log('\n---------- 基础健康检查 ----------');
  const healthRes = await get('/health');
  addResult(logResult('健康检查接口', 200, healthRes));

  const rootRes = await get('/');
  addResult(logResult('根路径接口', 200, rootRes));

  const notFoundRes = await get('/nonexistent');
  addResult(logResult('404 错误路径', 404, notFoundRes));

  console.log('\n---------- 正常路径测试 ----------');

  console.log('\n--- 温度事件导入测试 ---');
  
  const now = new Date();
  const normalEvent = {
    box_number: 'BOX-001',
    temperature: 5,
    event_time: now.toISOString()
  };
  
  const normalRes = await post('/api/temperature/events', normalEvent);
  const normalPass = logResult('正常温度事件导入 (2-8°C范围内)', 201, normalRes, 
    (r) => r.statusCode === 201 && r.body.success === true && r.body.data && r.body.data.is_alert === false);
  addResult(normalPass);

  const earlyMorning = new Date(now);
  earlyMorning.setHours(2, 30, 0, 0);
  const coldAlertEvent = {
    box_number: 'BOX-001',
    temperature: 1,
    event_time: earlyMorning.toISOString()
  };
  
  const coldAlertRes = await post('/api/temperature/events', coldAlertEvent);
  const coldAlertPass = logResult('低温超标事件导入 (1°C < 2°C)', 201, coldAlertRes,
    (r) => r.statusCode === 201 && r.body.data && r.body.data.is_alert === true);
  addResult(coldAlertPass);

  const afternoon = new Date(now);
  afternoon.setHours(14, 30, 0, 0);
  const hotAlertEvent = {
    box_number: 'BOX-001',
    temperature: 12,
    event_time: afternoon.toISOString()
  };
  
  const hotAlertRes = await post('/api/temperature/events', hotAlertEvent);
  const hotAlertPass = logResult('高温超标事件导入 (12°C > 8°C)', 201, hotAlertRes,
    (r) => r.statusCode === 201 && r.body.data && r.body.data.is_alert === true);
  addResult(hotAlertPass);

  const seafoodBox = {
    box_number: 'BOX-003',
    temperature: -15,
    event_time: now.toISOString()
  };
  
  const seafoodRes = await post('/api/temperature/events', seafoodBox);
  const seafoodPass = logResult('海鲜箱正常温度导入 (-18~-12°C范围内)', 201, seafoodRes,
    (r) => r.statusCode === 201 && r.body.data && r.body.data.is_alert === false);
  addResult(seafoodPass);

  const seafoodHotEvent = {
    box_number: 'BOX-003',
    temperature: -5,
    event_time: now.toISOString()
  };
  
  const seafoodHotRes = await post('/api/temperature/events', seafoodHotEvent);
  const seafoodHotPass = logResult('海鲜箱温度超标导入 (-5°C > -12°C)', 201, seafoodHotRes,
    (r) => r.statusCode === 201 && r.body.data && r.body.data.is_alert === true);
  addResult(seafoodHotPass);

  console.log('\n--- 批量导入测试 ---');
  const batchEvents = {
    events: [
      {
        box_number: 'BOX-002',
        temperature: 3,
        event_time: new Date(now.getTime() - 3600000).toISOString()
      },
      {
        box_number: 'BOX-002',
        temperature: 15,
        event_time: new Date(now.getTime() - 7200000).toISOString()
      },
      {
        box_number: 'BOX-004',
        temperature: -70,
        event_time: new Date(now.getTime() - 10800000).toISOString()
      }
    ]
  };
  
  const batchRes = await post('/api/temperature/events/batch', batchEvents);
  const batchPass = logResult('批量导入温度事件', 201, batchRes,
    (r) => r.statusCode === 201 && r.body.success === true && r.body.data.total === 3);
  addResult(batchPass);

  console.log('\n--- 重复事件去重测试 ---');
  const duplicateRes = await post('/api/temperature/events', normalEvent);
  const duplicatePass = logResult('重复事件导入 - 应该被拒绝', 409, duplicateRes,
    (r) => r.statusCode === 409 && r.body.code === 'DUPLICATE_EVENT');
  addResult(duplicatePass);

  console.log('\n--- 责任归因验证 ---');
  const eveningUTC = new Date(now);
  eveningUTC.setUTCHours(20, 30, 0, 0);
  const shiftTestEvent = {
    box_number: 'BOX-001',
    temperature: 6,
    event_time: eveningUTC.toISOString()
  };
  
  const shiftTestRes = await post('/api/temperature/events', shiftTestEvent);
  const shiftPass = logResult('中班事件责任归因 (UTC 20:30 应该归属中班 16:00-00:00)', 201, shiftTestRes,
    (r) => r.statusCode === 201 && r.body.data && r.body.data.shift_name === '中班');
  addResult(shiftPass);

  console.log('\n---------- 追溯查询测试 ----------');

  const queryOrderRes = await get('/api/trace/order/ORD-2024-001');
  const queryOrderPass = logResult('按订单号查询 (ORD-2024-001)', 200, queryOrderRes,
    (r) => r.statusCode === 200 && r.body.data && r.body.data.events.length > 0);
  addResult(queryOrderPass);

  const queryBoxRes = await get('/api/trace/box/BOX-001');
  const queryBoxPass = logResult('按箱号查询 (BOX-001)', 200, queryBoxRes,
    (r) => r.statusCode === 200 && r.body.data && r.body.data.events.length > 0);
  addResult(queryBoxPass);

  const queryShiftRes = await get('/api/trace/shift/早班');
  addResult(logResult('按班次查询 (早班)', 200, queryShiftRes,
    (r) => r.statusCode === 200 && r.body.success === true));

  const yesterday = new Date(now.getTime() - 86400000);
  const tomorrow = new Date(now.getTime() + 86400000);
  const timeRangeRes = await get(`/api/trace/time-range?startTime=${encodeURIComponent(yesterday.toISOString())}&endTime=${encodeURIComponent(tomorrow.toISOString())}`);
  const timeRangePass = logResult('按时间范围查询', 200, timeRangeRes,
    (r) => r.statusCode === 200 && r.body.data && r.body.data.events.length > 0);
  addResult(timeRangePass);

  const alertOnlyRes = await get('/api/trace/order/ORD-2024-001?onlyAlerts=true');
  addResult(logResult('仅查询告警事件', 200, alertOnlyRes,
    (r) => r.statusCode === 200 && r.body.success === true));

  const firstEventId = queryOrderRes.body.data.events[0]?.id;
  if (firstEventId) {
    const eventDetailRes = await get(`/api/trace/events/${firstEventId}`);
    const detailPass = logResult('查询事件详情', 200, eventDetailRes,
      (r) => r.statusCode === 200 && r.body.data && r.body.data.id === firstEventId);
    addResult(detailPass);
  }

  const statsRes = await get('/api/trace/statistics');
  const statsPass = logResult('查询统计数据', 200, statsRes,
    (r) => r.statusCode === 200 && r.body.data && r.body.data.overall);
  addResult(statsPass);

  console.log('\n---------- 异常路径测试 ----------');

  console.log('\n--- 参数验证错误 ---');
  
  const missingBox = {
    temperature: 5,
    event_time: now.toISOString()
  };
  const missingBoxRes = await post('/api/temperature/events', missingBox);
  const missingBoxPass = logResult('缺少箱号参数', 400, missingBoxRes,
    (r) => r.statusCode === 400 && r.body.code === 'VALIDATION_ERROR');
  addResult(missingBoxPass);

  const invalidTemp = {
    box_number: 'BOX-001',
    temperature: 'abc',
    event_time: now.toISOString()
  };
  const invalidTempRes = await post('/api/temperature/events', invalidTemp);
  const invalidTempPass = logResult('无效温度类型', 400, invalidTempRes,
    (r) => r.statusCode === 400 && r.body.code === 'VALIDATION_ERROR');
  addResult(invalidTempPass);

  const invalidTime = {
    box_number: 'BOX-001',
    temperature: 5,
    event_time: 'not-a-date'
  };
  const invalidTimeRes = await post('/api/temperature/events', invalidTime);
  const invalidTimePass = logResult('无效时间格式', 400, invalidTimeRes,
    (r) => r.statusCode === 400 && r.body.code === 'VALIDATION_ERROR');
  addResult(invalidTimePass);

  const emptyBatch = {
    events: []
  };
  const emptyBatchRes = await post('/api/temperature/events/batch', emptyBatch);
  const emptyBatchPass = logResult('空批量导入', 400, emptyBatchRes,
    (r) => r.statusCode === 400 && r.body.code === 'VALIDATION_ERROR');
  addResult(emptyBatchPass);

  console.log('\n--- 查询参数异常 ---');
  
  const invalidTimeRangeRes = await get('/api/trace/time-range?startTime=bad-date&endTime=also-bad');
  const invalidTimeRangePass = logResult('无效时间范围查询', 400, invalidTimeRangeRes,
    (r) => r.statusCode === 400 && r.body.code === 'VALIDATION_ERROR');
  addResult(invalidTimeRangePass);

  const missingRangeRes = await get('/api/trace/time-range');
  addResult(logResult('缺少时间范围参数', 400, missingRangeRes,
    (r) => r.statusCode === 400));

  const notFoundEventRes = await get('/api/trace/events/999999');
  const notFoundEventPass = logResult('查询不存在的事件', 404, notFoundEventRes,
    (r) => r.statusCode === 404 && r.body.code === 'NOT_FOUND');
  addResult(notFoundEventPass);

  console.log('\n--- 边界状态测试 ---');
  
  const boundaryMin = {
    box_number: 'BOX-001',
    temperature: 2,
    event_time: new Date(now.getTime() + 3600000).toISOString()
  };
  const boundaryMinRes = await post('/api/temperature/events', boundaryMin);
  const boundaryMinPass = logResult('温度等于最低阈值 (2°C)', 201, boundaryMinRes,
    (r) => r.statusCode === 201 && r.body.data && r.body.data.is_alert === false);
  addResult(boundaryMinPass);

  const boundaryMax = {
    box_number: 'BOX-001',
    temperature: 8,
    event_time: new Date(now.getTime() + 7200000).toISOString()
  };
  const boundaryMaxRes = await post('/api/temperature/events', boundaryMax);
  const boundaryMaxPass = logResult('温度等于最高阈值 (8°C)', 201, boundaryMaxRes,
    (r) => r.statusCode === 201 && r.body.data && r.body.data.is_alert === false);
  addResult(boundaryMaxPass);

  const unknownBox = {
    box_number: 'BOX-UNKNOWN-999',
    temperature: 25,
    event_time: new Date(now.getTime() + 10800000).toISOString()
  };
  const unknownBoxRes = await post('/api/temperature/events', unknownBox);
  const unknownBoxPass = logResult('未知箱号导入 (无阈值判定)', 201, unknownBoxRes,
    (r) => r.statusCode === 201 && r.body.data && r.body.data.is_alert === false);
  addResult(unknownBoxPass);

  console.log('\n---------- 测试结果汇总 ----------');
  console.log(`总计: ${results.total} 个测试`);
  console.log(`通过: ${results.pass} 个 ✓`);
  console.log(`失败: ${results.fail} 个 ✗`);
  console.log(`通过率: ${((results.pass / results.total) * 100).toFixed(1)}%`);

  if (results.fail === 0) {
    console.log('\n🎉 所有测试通过！API 正常运行。');
    process.exit(0);
  } else {
    console.log('\n⚠️  有测试失败，请检查。');
    process.exit(1);
  }
}

async function waitForServer() {
  console.log('等待服务器启动...');
  for (let i = 0; i < 30; i++) {
    try {
      await get('/health');
      console.log('服务器已就绪！');
      return true;
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  console.error('无法连接到服务器，请确认服务已启动。');
  process.exit(1);
}

(async () => {
  if (process.argv.includes('--wait')) {
    await waitForServer();
  }
  await runTests();
})();
