const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(JSON.stringify(body)) } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: response });
        } catch (err) {
          resolve({ status: res.statusCode, data: { raw: data } });
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

function printTest(title, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`\n${status}: ${title}`);
  if (details) {
    console.log(`   ${details}`);
  }
}

async function waitForServer() {
  console.log('等待服务启动...');
  for (let i = 0; i < 30; i++) {
    try {
      const res = await request('/api/health');
      if (res.status === 200) {
        console.log('服务已就绪\n');
        return true;
      }
    } catch (e) {
      // ignore
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('服务启动超时');
}

async function testCrossCategoryConflictDetection() {
  console.log('\n' + '═'.repeat(60));
  console.log(' 【测试1】跨类别冲突检测');
  console.log('  目标：验证设备/物料/人员各一条原因时能识别冲突');
  console.log('═'.repeat(60));

  let lineStopId = null;
  let reasonIds = [];

  console.log('\n--- 步骤1：创建停线事件 ---');
  let res = await request('/api/line-stops', 'POST', {
    lineCode: 'LINE-CONFLICT-TEST',
    lineName: '冲突测试线',
    operator: '测试员',
    initialDescription: '测试跨类别冲突检测'
  });
  lineStopId = res.data.data.lineStop.id;
  console.log(`事件ID: ${lineStopId}`);
  printTest('创建事件成功', res.status === 201);

  console.log('\n--- 步骤2：提交设备原因 ---');
  res = await request(`/api/line-stops/${lineStopId}/reasons`, 'POST', {
    category: 'EQUIPMENT',
    source: '设备日志',
    reporter: '设备工程师',
    description: '电机故障'
  });
  reasonIds.push(res.data.data.id);
  printTest('设备原因提交成功', res.status === 201);

  console.log('\n--- 步骤3：提交物料原因 ---');
  res = await request(`/api/line-stops/${lineStopId}/reasons`, 'POST', {
    category: 'MATERIAL',
    source: '物料系统',
    reporter: '物料员',
    description: '零件质量问题'
  });
  reasonIds.push(res.data.data.id);
  printTest('物料原因提交成功', res.status === 201);

  console.log('\n--- 步骤4：提交人员原因 ---');
  res = await request(`/api/line-stops/${lineStopId}/reasons`, 'POST', {
    category: 'PERSONNEL',
    source: '人工记录',
    reporter: '班长',
    description: '操作失误'
  });
  reasonIds.push(res.data.data.id);
  printTest('人员原因提交成功', res.status === 201);

  console.log('\n--- 步骤5：检测冲突（关键点） ---');
  console.log('当前状态：设备/物料/人员各有1条待确认原因');
  res = await request(`/api/line-stops/${lineStopId}/reasons/conflicts`);
  
  const conflictData = res.data.data;
  console.log(`\n冲突检测结果:`);
  console.log(`  - hasConflicts: ${conflictData.hasConflicts}`);
  console.log(`  - activeCategories: [${conflictData.activeCategories?.join(', ')}]`);
  console.log(`  - 冲突数量: ${conflictData.conflicts?.length || 0}`);
  console.log(`  - suggestion: ${conflictData.suggestion}`);
  
  const hasCrossCategoryConflict = conflictData.conflicts?.some(c => c.type === 'CROSS_CATEGORY');
  
  printTest(
    '检测到跨类别冲突（设备+物料+人员）',
    conflictData.hasConflicts === true && hasCrossCategoryConflict,
    `hasConflicts=${conflictData.hasConflicts}, 冲突类型包含CROSS_CATEGORY=${hasCrossCategoryConflict}`
  );

  if (conflictData.conflicts?.length > 0) {
    console.log('\n冲突详情:');
    conflictData.conflicts.forEach((c, i) => {
      console.log(`  ${i+1}. 类型: ${c.type}`);
      console.log(`     消息: ${c.message}`);
      console.log(`     详情: ${c.detail}`);
    });
  }

  console.log('\n--- 步骤6：解决冲突（确认一个，拒绝其他） ---');
  res = await request(`/api/line-stops/reasons/${reasonIds[0]}/confirm`, 'POST', {
    operator: '经理',
    isPrimary: true
  });
  printTest('确认设备原因（主因）', res.status === 200);

  res = await request(`/api/line-stops/reasons/${reasonIds[1]}/reject`, 'POST', {
    operator: '经理',
    rejectReason: '经核实，排除物料原因'
  });
  printTest('拒绝物料原因', res.status === 200);

  res = await request(`/api/line-stops/reasons/${reasonIds[2]}/reject`, 'POST', {
    operator: '经理',
    rejectReason: '经核实，排除人员原因'
  });
  printTest('拒绝人员原因', res.status === 200);

  console.log('\n--- 步骤7：冲突解决后再次检测 ---');
  res = await request(`/api/line-stops/${lineStopId}/reasons/conflicts`);
  const resolvedData = res.data.data;
  
  printTest(
    '冲突解决后无冲突',
    resolvedData.hasConflicts === false,
    `hasConflicts=${resolvedData.hasConflicts}, suggestion=${resolvedData.suggestion}`
  );

  return lineStopId;
}

async function testAppealAndReassign() {
  console.log('\n\n' + '═'.repeat(60));
  console.log('  【测试2】责任申诉后重新分配');
  console.log('  目标：验证申诉后可以创建新的责任记录');
  console.log('═'.repeat(60));

  let lineStopId = null;
  let responsibilityId = null;

  console.log('\n--- 步骤1：创建停线事件 ---');
  let res = await request('/api/line-stops', 'POST', {
    lineCode: 'LINE-APPEAL-TEST',
    lineName: '申诉测试线',
    operator: '测试员',
    initialDescription: '测试责任申诉流程'
  });
  lineStopId = res.data.data.lineStop.id;
  printTest('创建事件成功', res.status === 201);

  console.log('\n--- 步骤2：提交并确认原因 ---');
  res = await request(`/api/line-stops/${lineStopId}/reasons`, 'POST', {
    category: 'EQUIPMENT',
    source: '设备日志',
    reporter: '工程师A',
    description: '设备故障'
  });
  const reasonId = res.data.data.id;

  res = await request(`/api/line-stops/reasons/${reasonId}/confirm`, 'POST', {
    operator: '经理A',
    isPrimary: true
  });
  printTest('原因确认成功', res.status === 200);

  console.log('\n--- 步骤3：分配责任 ---');
  res = await request(`/api/line-stops/${lineStopId}/responsibilities`, 'POST', {
    responsibleDepartment: '设备部',
    responsiblePerson: '工程师B',
    reason: '设备维护责任',
    confirmedBy: '经理A'
  });
  responsibilityId = res.data.data.id;
  printTest('责任分配成功', res.status === 201);

  res = await request(`/api/line-stops/${lineStopId}`);
  console.log(`当前事件状态: ${res.data.data.lineStop.status}`);

  console.log('\n--- 步骤4：对责任提出申诉 ---');
  res = await request(`/api/line-stops/responsibilities/${responsibilityId}/appeal`, 'POST', {
    operator: '工程师B',
    appealReason: '设备故障是由于物料质量问题导致，非维护责任'
  });
  printTest('责任申诉成功', res.status === 200);
  console.log(`申诉后责任状态: ${res.data.data.responsibility.status}`);

  res = await request(`/api/line-stops/${lineStopId}`);
  console.log(`事件状态回退到: ${res.data.data.lineStop.status}`);

  console.log('\n--- 步骤5：尝试重新分配责任（关键点） ---');
  console.log('旧责任状态为 APPEALED，应该允许创建新的责任记录');
  
  res = await request(`/api/line-stops/${lineStopId}/responsibilities`, 'POST', {
    responsibleDepartment: '物料部',
    responsiblePerson: '物料员C',
    reason: '物料质量问题导致设备损坏',
    confirmedBy: '经理A'
  });
  
  const canReassign = res.status === 201;
  printTest(
    '申诉后可以重新分配责任',
    canReassign,
    canReassign 
      ? `成功！新责任ID: ${res.data.data.id}` 
      : `失败！错误: ${JSON.stringify(res.data)}`
  );

  if (canReassign) {
    res = await request(`/api/line-stops/${lineStopId}`);
    console.log(`重新分配后事件状态: ${res.data.data.lineStop.status}`);
    
    res = await request(`/api/line-stops/${lineStopId}/responsibilities`);
    const responsibilities = res.data.data;
    console.log(`\n当前责任记录数量: ${responsibilities.length}`);
    responsibilities.forEach((r, i) => {
      console.log(`  ${i+1}. ${r.responsibleDepartment}/${r.responsiblePerson} - 状态: ${r.status}`);
    });
  }

  return lineStopId;
}

async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('  生产停线复盘服务 - 修复验证测试');
  console.log('='.repeat(60));

  try {
    await waitForServer();

    const results = [];
    
    const id1 = await testCrossCategoryConflictDetection();
    results.push({ name: '跨类别冲突检测', id: id1 });
    
    const id2 = await testAppealAndReassign();
    results.push({ name: '责任申诉后重分配', id: id2 });

    console.log('\n\n' + '═'.repeat(60));
    console.log('  测试结果汇总');
    console.log('═'.repeat(60));
    
    results.forEach((r, i) => {
      console.log(`\n${i+1}. ${r.name}`);
      console.log(`   事件ID: ${r.id}`);
      console.log(`   查看: GET /api/line-stops/${r.id}/summary`);
    });

    console.log('\n✅ 所有修复验证测试完成！');
    console.log('\n📊 你可以用以下命令查看测试产生的数据:');
    results.forEach((r, i) => {
      console.log(`   curl http://localhost:3000/api/line-stops/${r.id}/summary`);
    });

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runAllTests();
