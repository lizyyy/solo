const https = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: body ? JSON.parse(body) : null });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function testAPI() {
  console.log('='.repeat(60));
  console.log('滑雪场压雪排程台 API 测试');
  console.log('='.repeat(60));
  
  // 1. 健康检查
  console.log('\n✅ 测试1: 健康检查');
  const health = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/health',
    method: 'GET'
  });
  console.log('   响应:', health.data);
  
  // 2. 获取雪道列表
  console.log('\n✅ 测试2: 获取雪道列表');
  const slopes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/slopes',
    method: 'GET'
  });
  console.log(`   共 ${slopes.data.data.length} 条雪道`);
  slopes.data.data.forEach(s => {
    const needsGrooming = s.currentSnowThickness < s.minSnowThickness;
    console.log(`   - ${s.name}: 当前${s.currentSnowThickness}cm < 最小${s.minSnowThickness}cm ${needsGrooming ? '[需要压雪]' : ''}`);
  });
  
  const firstSlopeId = slopes.data.data[0].id;
  
  // 3. 获取需要压雪的雪道
  console.log('\n✅ 测试3: 获取需要压雪的雪道');
  const needingGrooming = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/slopes/needing-grooming',
    method: 'GET'
  });
  console.log(`   共 ${needingGrooming.data.data.length} 条雪道需要压雪`);
  
  // 4. 测试开放窗口限制（应该失败 - 在开放时间内）
  console.log('\n❌ 测试4: 创建任务（应该失败 - 在开放窗口内）');
  const tomorrowDay = new Date();
  tomorrowDay.setDate(tomorrowDay.getDate() + 1);
  tomorrowDay.setHours(10, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowDay.getTime() + 2 * 60 * 60 * 1000);
  
  const failTask = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/tasks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    slopeId: firstSlopeId,
    scheduledStartTime: tomorrowDay.toISOString(),
    scheduledEndTime: tomorrowEnd.toISOString()
  });
  
  console.log('   HTTP 状态码:', failTask.status);
  console.log('   错误信息:', failTask.data?.message);
  
  if (failTask.status === 400 && failTask.data?.message?.includes('开放时间')) {
    console.log('   ✅ 正确拒绝了在开放窗口内的任务');
  } else {
    console.log('   ❌ 错误：应该失败但没有');
  }
  
  // 5. 创建有效任务（应该成功 - 在夜间）
  console.log('\n✅ 测试5: 创建任务（应该成功 - 在夜间作业窗口）');
  const tonight = new Date();
  tonight.setDate(tonight.getDate() + 1);
  tonight.setHours(22, 0, 0, 0);
  const tonightEnd = new Date(tonight.getTime() + 2 * 60 * 60 * 1000);
  
  const successTask = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/tasks',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    slopeId: firstSlopeId,
    scheduledStartTime: tonight.toISOString(),
    scheduledEndTime: tonightEnd.toISOString(),
    notes: 'API测试任务'
  });
  
  console.log('   HTTP 状态码:', successTask.status);
  if (successTask.status === 201) {
    console.log('   ✅ 任务创建成功');
    console.log('   任务ID:', successTask.data.data.id);
    console.log('   状态:', successTask.data.data.status);
    console.log('   雪道:', successTask.data.data.slope?.name);
  } else {
    console.log('   ❌ 创建失败:', successTask.data?.message);
  }
  
  // 6. 自动排程
  console.log('\n✅ 测试6: 自动排程');
  const autoSchedule = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/tasks/auto-schedule',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (autoSchedule.status === 200) {
    const results = autoSchedule.data.data;
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    console.log(`   成功: ${successCount} 条, 失败: ${failCount} 条`);
    results.forEach((r, i) => {
      if (r.success) {
        console.log(`   [${i+1}] ${r.slopeName} → ${r.vehicleName} (预计${r.estimatedHours}小时)`);
      } else {
        console.log(`   [${i+1}] ${r.slopeName} → 失败: ${r.message}`);
      }
    });
  }
  
  // 7. 获取车辆列表
  console.log('\n✅ 测试7: 获取车辆列表');
  const vehicles = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/vehicles',
    method: 'GET'
  });
  console.log(`   共 ${vehicles.data.data.length} 台车辆`);
  vehicles.data.data.forEach(v => {
    console.log(`   - ${v.name}: ${v.model}, 状态: ${v.status}`);
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('测试完成！');
  console.log('='.repeat(60));
}

testAPI().catch(console.error);
