const http = require('http');

const BASE_URL = 'http://localhost:3001';

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      path,
      hostname: 'localhost',
      port: 3001,
      headers: { 'Content-Type': 'application/json' }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
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
}

async function runQuickStart() {
  console.log('========================================');
  console.log('    工地塔吊吊次排程 API - 快速演示');
  console.log('========================================\n');
  
  console.log('【第1步】基础档案建设');
  console.log('--------------------\n');
  
  console.log('1.1 创建塔吊1号 (最大风速 20 m/s)');
  const crane1 = await makeRequest('POST', '/api/cranes', {
    code: 'TC-001',
    name: '1号塔吊',
    max_wind_speed: 20.0,
    max_load: 12.0,
    building_range: '1-5'
  });
  console.log('  响应:', crane1.status, crane1.data.data ? crane1.data.data.code : crane1.data.error);
  
  console.log('\n1.2 创建塔吊2号 (最大风速 15 m/s)');
  const crane2 = await makeRequest('POST', '/api/cranes', {
    code: 'TC-002',
    name: '2号塔吊',
    max_wind_speed: 15.0,
    max_load: 8.0,
    building_range: '6-10'
  });
  console.log('  响应:', crane2.status, crane2.data.data ? crane2.data.data.code : crane2.data.error);
  
  console.log('\n1.3 创建材料档案（带优先级）');
  
  const steel = await makeRequest('POST', '/api/cranes/materials', {
    code: 'STEEL-001',
    name: '钢筋（紧急）',
    priority: 90,
    average_weight: 2.5
  });
  console.log('  钢筋(优先级90):', steel.status);
  
  const concrete = await makeRequest('POST', '/api/cranes/materials', {
    code: 'CONC-001',
    name: '混凝土',
    priority: 70,
    average_weight: 5.0
  });
  console.log('  混凝土(优先级70):', concrete.status);
  
  const brick = await makeRequest('POST', '/api/cranes/materials', {
    code: 'BRICK-001',
    name: '砖块',
    priority: 30,
    average_weight: 1.0
  });
  console.log('  砖块(优先级30):', brick.status);
  
  console.log('\n【第2步】设置当前风速 = 12 m/s');
  console.log('------------------------------\n');
  
  await makeRequest('POST', '/api/cranes/weather/wind-speed', { wind_speed: 12 });
  console.log('  已记录风速: 12 m/s');
  
  console.log('\n【第3步】创建多个吊次申请');
  console.log('--------------------------\n');
  
  const app1 = await makeRequest('POST', '/api/applications', {
    crane_code: 'TC-001',
    material_code: 'STEEL-001',
    building_no: '3',
    floor: 12,
    quantity: 4,
    requested_by: '张工长'
  });
  console.log('  申请1 (1号吊-钢筋-3号楼):', app1.data.data ? app1.data.data.application_no : app1.data.error);
  
  const app2 = await makeRequest('POST', '/api/applications', {
    crane_code: 'TC-001',
    material_code: 'BRICK-001',
    building_no: '2',
    floor: 5,
    quantity: 10,
    requested_by: '李工长'
  });
  console.log('  申请2 (1号吊-砖块-2号楼):', app2.data.data ? app2.data.data.application_no : app2.data.error);
  
  const app3 = await makeRequest('POST', '/api/applications', {
    crane_code: 'TC-002',
    material_code: 'CONC-001',
    building_no: '7',
    floor: 8,
    quantity: 1,
    requested_by: '王工长'
  });
  console.log('  申请3 (2号吊-混凝土-7号楼):', app3.data.data ? app3.data.data.application_no : app3.data.error);
  
  console.log('\n【第4步】查看排程引擎结果');
  console.log('--------------------------\n');
  
  const schedule = await makeRequest('GET', '/api/schedule/generate');
  const scheduleData = schedule.data.data;
  
  console.log('  当前风速:', scheduleData.current_wind_speed, 'm/s');
  console.log('  总待排数:', scheduleData.total_pending);
  console.log('  可执行:', scheduleData.can_execute_count);
  console.log('  被阻挡:', scheduleData.blocked_count);
  
  console.log('\n  排程顺序（按优先级降序）:');
  scheduleData.schedule.forEach((item, idx) => {
    const status = item.constraints.can_execute ? '✓ 可执行' : '✗ 被阻挡';
    console.log(`    ${idx + 1}. ${item.material_name}(${item.material_priority}) → ${item.crane_code} ${status}`);
    if (!item.constraints.can_execute) {
      item.constraints.blocks.forEach(b => console.log(`       原因: ${b.message}`));
    }
  });
  
  console.log('\n【第5步】模拟风速变化到 18 m/s');
  console.log('-------------------------------\n');
  
  await makeRequest('POST', '/api/cranes/weather/wind-speed', { wind_speed: 18 });
  console.log('  已更新风速: 18 m/s');
  
  const schedule2 = await makeRequest('GET', '/api/schedule/generate');
  const scheduleData2 = schedule2.data.data;
  
  console.log('\n  重新排程结果:');
  console.log('  当前风速:', scheduleData2.current_wind_speed, 'm/s');
  console.log('  可执行:', scheduleData2.can_execute_count);
  console.log('  被阻挡:', scheduleData2.blocked_count);
  
  console.log('\n  阻挡明细:');
  scheduleData2.schedule.forEach(item => {
    if (!item.constraints.can_execute) {
      console.log(`    ${item.application_no}: ${item.material_name}`);
      item.constraints.blocks.forEach(b => console.log(`       ${b.message}`));
    }
  });
  
  console.log('\n【第6步】推进状态: 安排→开始→完成');
  console.log('-----------------------------------\n');
  
  const appId1 = app1.data.data.id;
  
  console.log('  6.1 安排吊次');
  const scheduled = await makeRequest('POST', `/api/applications/${appId1}/schedule`, {
    performed_by: '调度员A',
    reason: '紧急材料优先安排'
  });
  console.log('    新状态:', scheduled.data.data.status);
  
  console.log('\n  6.2 开始执行（风速超过2号塔吊限制）');
  await makeRequest('POST', '/api/cranes/weather/wind-speed', { wind_speed: 10 });
  const started = await makeRequest('POST', `/api/applications/${appId1}/start`, {
    performed_by: '操作员老王',
    operator: '老王'
  });
  console.log('    新状态:', started.data.data.status);
  
  console.log('\n  6.3 完成吊次');
  const completed = await makeRequest('POST', `/api/applications/${appId1}/complete`, {
    performed_by: '操作员老王'
  });
  console.log('    新状态:', completed.data.data.status);
  
  console.log('\n【第7步】边界情况测试');
  console.log('----------------------\n');
  
  console.log('  7.1 重复提交（同一申请单号防重）');
  const dup = await makeRequest('POST', '/api/applications', {
    crane_code: 'TC-001',
    material_code: 'STEEL-001',
    building_no: '3',
    floor: 12,
    quantity: 5,
    requested_by: '张工长'
  });
  console.log('    状态码:', dup.status);
  
  console.log('\n  7.2 状态冲突（已完成状态无法修改）');
  const conflict = await makeRequest('POST', `/api/applications/${appId1}/revise`, {
    floor: 15,
    performed_by: '某人'
  });
  console.log('    状态码:', conflict.status, '-', conflict.data.code);
  
  console.log('\n  7.3 来源记录缺失测试');
  const missing = await makeRequest('POST', '/api/applications', {
    crane_code: 'TC-001',
    material_code: 'STEEL-001',
    building_no: '3',
    floor: 12,
    quantity: 5,
    requested_by: '张工长',
    source_record_id: 'non-existent-id-12345'
  });
  console.log('    状态码:', missing.status, '-', missing.data.code);
  
  console.log('\n【第8步】查看报表');
  console.log('-------------------\n');
  
  console.log('  8.1 看板总览');
  const dashboard = await makeRequest('GET', '/api/reports/dashboard');
  console.log('    今日完成:', dashboard.data.data.overview.today_completed);
  console.log('    待处理:', dashboard.data.data.overview.pending);
  console.log('    进行中:', dashboard.data.data.overview.in_progress);
  
  console.log('\n  8.2 材料优先级报告');
  const matReport = await makeRequest('GET', '/api/reports/material-priority');
  console.log('    各材料使用情况:');
  matReport.data.data.materials.forEach(m => {
    console.log(`      ${m.name} (优先级${m.priority}): 已完成${m.completed_count}, 待排${m.pending_count}`);
  });
  
  console.log('\n  8.3 复核面板');
  const review = await makeRequest('GET', '/api/schedule/review-panel');
  const rev = review.data.data;
  console.log('    总览: 就绪', rev.summary.ready, '/ 警告', rev.summary.warnings, '/ 阻挡', rev.summary.blocked);
  
  console.log('\n========================================');
  console.log('    演示完成！主线清晰可见:');
  console.log('    塔吊吊次 → 材料优先级 → 风速限制');
  console.log('========================================');
}

runQuickStart().catch(console.error);
