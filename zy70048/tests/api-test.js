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

function printStep(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(` ${title}`);
  console.log(`${'='.repeat(60)}`);
}

function printResponse(label, res) {
  console.log(`\n--- ${label} ---`);
  console.log(`Status: ${res.status}`);
  console.log(`Response: ${JSON.stringify(res.data, null, 2)}`);
}

async function waitForServer() {
  console.log('等待服务启动...');
  for (let i = 0; i < 30; i++) {
    try {
      const res = await request('/api/health');
      if (res.status === 200) {
        console.log('服务已就绪');
        return true;
      }
    } catch (e) {
      // ignore
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('服务启动超时');
}

async function runNormalFlow() {
  printStep('【测试1】正常业务流程演示');
  
  let lineStopId = null;
  let reason1Id = null;
  let reason2Id = null;
  let responsibilityId = null;
  let recoveryId = null;
  let reportId = null;

  printStep('1. 创建停线事件');
  let res = await request('/api/line-stops', 'POST', {
    lineCode: 'LINE-A01',
    lineName: '装配线A01',
    operator: '张三',
    initialDescription: '生产线突发停机，设备报警',
    estimatedDuration: 30
  });
  printResponse('创建停线事件', res);
  lineStopId = res.data.data.lineStop.id;
  console.log(`\n停线事件ID: ${lineStopId}`);
  console.log(`当前状态: ${res.data.data.lineStop.status} (${res.data.data.currentStatus.description})`);

  printStep('2. 提交多个来源的停线原因（模拟设备、物料、人员的矛盾记录）');
  
  res = await request(`/api/line-stops/${lineStopId}/reasons`, 'POST', {
    category: 'EQUIPMENT',
    subCategory: '机械故障',
    source: '设备日志系统',
    reporter: '设备工程师-李四',
    description: '主轴电机过载保护触发，电流异常升高',
    evidence: '设备报警代码: ERR-001, 记录时间: 10:30:05',
    confidence: 0.85
  });
  printResponse('提交设备原因', res);
  reason1Id = res.data.data.id;

  res = await request(`/api/line-stops/${lineStopId}/reasons`, 'POST', {
    category: 'MATERIAL',
    subCategory: '质量问题',
    source: '物料系统',
    reporter: '物料员-王五',
    description: '批次B20240508的零件尺寸超差，导致卡死',
    evidence: '检验报告编号: QC-2024-0508',
    confidence: 0.70
  });
  printResponse('提交物料原因', res);
  reason2Id = res.data.data.id;

  res = await request(`/api/line-stops/${lineStopId}/reasons`, 'POST', {
    category: 'PERSONNEL',
    subCategory: '操作失误',
    source: '人工记录',
    reporter: '班长-赵六',
    description: '操作员未按SOP执行，跳过了关键检查步骤',
    evidence: '操作记录视频',
    confidence: 0.60
  });
  printResponse('提交人员原因', res);

  printStep('3. 查看原因冲突情况');
  res = await request(`/api/line-stops/${lineStopId}/reasons/conflicts`);
  printResponse('原因冲突分析', res);

  printStep('4. 确认主要原因（选择设备原因为主因）');
  res = await request(`/api/line-stops/reasons/${reason1Id}/confirm`, 'POST', {
    operator: '生产经理-孙七',
    isPrimary: true
  });
  printResponse('确认设备原因（主要）', res);

  res = await request(`/api/line-stops/reasons/${reason2Id}/confirm`, 'POST', {
    operator: '生产经理-孙七',
    isPrimary: false
  });
  printResponse('确认物料原因（次要）', res);

  printStep('5. 查看当前停线事件状态');
  res = await request(`/api/line-stops/${lineStopId}`);
  printResponse('停线事件详情', res);
  console.log(`\n当前状态: ${res.data.data.lineStop.status}`);
  console.log(`允许的状态流转: ${res.data.data.allowedTransitions.join(', ')}`);

  printStep('6. 分配责任');
  res = await request(`/api/line-stops/${lineStopId}/responsibilities`, 'POST', {
    responsibleDepartment: '设备部',
    responsiblePerson: '李四',
    reason: '设备日常维护不到位，导致电机过载',
    severity: 'MAJOR',
    correctiveAction: '更换电机，检查传动系统',
    preventiveAction: '建立定期维护计划，增加巡检频率',
    confirmedBy: '生产经理-孙七'
  });
  printResponse('分配责任', res);
  responsibilityId = res.data.data.id;

  printStep('7. 开始复产');
  res = await request(`/api/line-stops/${lineStopId}/recovery`, 'POST', {
    operator: '设备工程师-李四',
    actions: '1. 断开电源 2. 检查电机 3. 更换过热部件 4. 重新校准',
    verificationItems: [
      { item: '电机温度', result: '正常', expected: '<80°C' },
      { item: '电流值', result: '正常', expected: '15-20A' }
    ]
  });
  printResponse('开始复产', res);
  recoveryId = res.data.data.id;

  printStep('8. 完成复产');
  res = await request(`/api/line-stops/recovery/${recoveryId}/complete`, 'POST', {
    operator: '设备工程师-李四',
    remarks: '所有检查项通过，设备运行正常'
  });
  printResponse('完成复产', res);

  printStep('9. 创建复盘报告');
  res = await request(`/api/line-stops/${lineStopId}/reports`, 'POST', {
    summary: '2024年5月8日装配线A01停线事件，持续约25分钟',
    rootCause: '设备维护计划执行不到位，电机轴承磨损未及时发现',
    impactAnalysis: '影响产量约500件，延误交付时间2小时',
    correctiveActions: '1. 立即更换受损电机 2. 全面检查同类型设备',
    preventiveActions: '1. 修订维护计划，增加关键部件检查频率 2. 建立设备运行监控系统 3. 培训维护人员',
    learnedLessons: '预防性维护比事后维修更重要，应建立数据驱动的维护策略',
    preparedBy: '质量工程师-周八'
  });
  printResponse('创建复盘报告', res);
  reportId = res.data.data.id;

  printStep('10. 提交报告审批');
  res = await request(`/api/line-stops/reports/${reportId}/submit`, 'POST', {
    operator: '质量工程师-周八'
  });
  printResponse('提交报告', res);

  printStep('11. 审批通过复盘报告');
  res = await request(`/api/line-stops/reports/${reportId}/approve`, 'POST', {
    operator: '生产总监-吴九',
    comments: '报告分析深入，预防措施可行。请设备部跟踪执行'
  });
  printResponse('审批报告', res);

  printStep('12. 查看完整汇总信息');
  res = await request(`/api/line-stops/${lineStopId}/summary`);
  printResponse('事件汇总', res);

  printStep('13. 查看状态历史时间轴');
  res = await request(`/api/line-stops/${lineStopId}/history`);
  printResponse('状态历史', res);

  return lineStopId;
}

async function runErrorScenarios() {
  printStep('【测试2】错误场景演示');

  printStep('1. 测试非法状态流转');
  let res = await request('/api/line-stops', 'POST', {
    lineCode: 'LINE-TEST',
    lineName: '测试线',
    operator: '测试员',
    initialDescription: '测试非法流转'
  });
  const testId = res.data.data.lineStop.id;
  console.log(`创建测试事件: ${testId}`);

  console.log('\n尝试在CREATED状态直接分配责任（应失败）');
  res = await request(`/api/line-stops/${testId}/responsibilities`, 'POST', {
    responsibleDepartment: '测试部',
    responsiblePerson: '测试员',
    reason: '测试',
    confirmedBy: '测试员'
  });
  printResponse('非法状态流转测试', res);

  printStep('2. 测试重复提交原因');
  console.log('\n第一次提交原因');
  res = await request(`/api/line-stops/${testId}/reasons`, 'POST', {
    category: 'EQUIPMENT',
    source: '测试来源',
    reporter: '测试员',
    description: '第一次提交'
  });
  printResponse('第一次提交', res);

  console.log('\n同一来源同一类别重复提交（应失败）');
  res = await request(`/api/line-stops/${testId}/reasons`, 'POST', {
    category: 'EQUIPMENT',
    source: '测试来源',
    reporter: '测试员',
    description: '重复提交'
  });
  printResponse('重复提交测试', res);

  printStep('3. 测试在错误状态执行操作');
  console.log('\n尝试在没有复产记录的情况下完成复产（应失败）');
  res = await request(`/api/line-stops/recovery/fake-id/complete`, 'POST', {
    operator: '测试员'
  });
  printResponse('不存在的记录测试', res);

  printStep('4. 测试参数验证');
  console.log('\n提交缺少必要字段的请求（应失败）');
  res = await request('/api/line-stops', 'POST', {
    lineCode: 'LINE-TEST2'
  });
  printResponse('参数验证测试', res);

  return testId;
}

async function runEdgeCases() {
  printStep('【测试3】边界场景和申诉机制');

  printStep('1. 创建新事件演示申诉流程');
  let res = await request('/api/line-stops', 'POST', {
    lineCode: 'LINE-APPEAL',
    operator: '操作员A',
    initialDescription: '申诉流程测试'
  });
  const appealId = res.data.data.lineStop.id;

  res = await request(`/api/line-stops/${appealId}/reasons`, 'POST', {
    category: 'EQUIPMENT',
    source: '设备系统',
    reporter: '工程师A',
    description: '设备故障'
  });
  const reasonId = res.data.data.id;

  res = await request(`/api/line-stops/reasons/${reasonId}/confirm`, 'POST', {
    operator: '经理A',
    isPrimary: true
  });

  res = await request(`/api/line-stops/${appealId}/responsibilities`, 'POST', {
    responsibleDepartment: '设备部',
    responsiblePerson: '工程师B',
    reason: '设备维护责任',
    confirmedBy: '经理A'
  });
  const respId = res.data.data.id;

  printStep('2. 责任申诉（回退状态）');
  console.log('\n工程师B对责任分配提出申诉');
  res = await request(`/api/line-stops/responsibilities/${respId}/appeal`, 'POST', {
    operator: '工程师B',
    appealReason: '设备故障是由于物料质量问题导致，非维护责任'
  });
  printResponse('责任申诉', res);

  console.log('\n查看申诉后的状态');
  res = await request(`/api/line-stops/${appealId}`);
  console.log(`当前状态: ${res.data.data.lineStop.status}`);
  console.log('（状态已回退到 REASON_CONFIRMED，可以重新分析原因）');

  printStep('3. 复产失败重试');
  console.log('\n重新分配责任后开始复产');
  res = await request(`/api/line-stops/${appealId}/responsibilities`, 'POST', {
    responsibleDepartment: '物料部',
    responsiblePerson: '物料员C',
    reason: '物料质量问题导致设备损坏',
    confirmedBy: '经理A'
  });
  printResponse('重新分配责任', res);

  console.log('\n查看当前状态');
  res = await request(`/api/line-stops/${appealId}`);
  console.log(`当前状态: ${res.data.data.lineStop.status}`);

  res = await request(`/api/line-stops/${appealId}/recovery`, 'POST', {
    operator: '工程师B',
    actions: '尝试修复'
  });
  printResponse('开始复产', res);
  
  if (res.status !== 201) {
    console.log('\n⚠️  复产启动失败，跳过后续复产测试');
    return appealId;
  }
  
  const recoveryId = res.data.data.id;

  console.log('\n复产失败');
  res = await request(`/api/line-stops/recovery/${recoveryId}/fail`, 'POST', {
    operator: '工程师B',
    failureReason: '发现更严重的损坏，需要更换零件'
  });
  printResponse('复产失败', res);

  console.log('\n重新开始复产（失败后可以重新启动）');
  res = await request(`/api/line-stops/${appealId}/recovery`, 'POST', {
    operator: '工程师B',
    actions: '1. 订购新零件 2. 更换受损部件 3. 全面测试'
  });
  const newRecoveryId = res.data.data.id;
  printResponse('重新复产', res);

  console.log('\n完成复产');
  res = await request(`/api/line-stops/recovery/${newRecoveryId}/complete`, 'POST', {
    operator: '工程师B'
  });
  printResponse('完成复产', res);

  return appealId;
}

async function runQueryTests(eventIds) {
  printStep('【测试4】查询功能演示');

  printStep('1. 查看所有停线事件列表');
  let res = await request('/api/line-stops');
  printResponse('事件列表', res);

  printStep('2. 按状态筛选');
  res = await request('/api/line-stops?status=COMPLETED');
  printResponse('已完成事件', res);

  printStep('3. 分页查询');
  res = await request('/api/line-stops?page=1&limit=2');
  printResponse('分页查询', res);

  printStep('4. 查看状态常量和流转规则');
  res = await request('/api/line-stops/constants');
  printResponse('状态常量', res);

  if (eventIds.length > 0) {
    printStep('5. 查看最终汇总报告');
    res = await request(`/api/line-stops/${eventIds[0]}/summary`);
    console.log('\n--- 完整汇总摘要 ---');
    const summary = res.data.data;
    console.log(`\n事件ID: ${summary.lineStop.id}`);
    console.log(`产线: ${summary.lineStop.lineCode} (${summary.lineStop.lineName})`);
    console.log(`状态: ${summary.lineStop.statusDescription}`);
    console.log(`停线时间: ${summary.lineStop.stopTime}`);
    console.log(`实际时长: ${summary.lineStop.actualDuration} 分钟`);
    console.log(`\n原因统计:`);
    console.log(`  - 总数: ${summary.reasons.total}`);
    console.log(`  - 已确认: ${summary.reasons.confirmed}`);
    Object.keys(summary.reasons.byCategory).forEach(cat => {
      console.log(`  - ${cat}: ${summary.reasons.byCategory[cat].count}条`);
    });
    if (summary.reasons.primaryReason) {
      console.log(`主要原因: ${summary.reasons.primaryReason.description}`);
    }
    console.log(`\n责任: ${summary.responsibility?.responsibleDepartment || '未分配'}`);
    console.log(`\n时间轴:`);
    summary.timeline.forEach((t, i) => {
      console.log(`  ${i+1}. [${t.timestamp}] ${t.operator}: ${t.reason}`);
    });
  }
}

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('    生产停线复盘服务 - 完整测试演示');
  console.log('═'.repeat(60));

  try {
    await waitForServer();

    const eventIds = [];

    const normalId = await runNormalFlow();
    eventIds.push(normalId);

    const errorId = await runErrorScenarios();
    eventIds.push(errorId);

    const edgeId = await runEdgeCases();
    eventIds.push(edgeId);

    await runQueryTests(eventIds);

    printStep('测试完成');
    console.log('\n✅ 所有测试场景执行完毕');
    console.log('\n📊 生成的事件ID:');
    eventIds.forEach((id, i) => console.log(`  ${i+1}. ${id}`));
    console.log('\n💡 提示: 你可以使用这些ID调用API查看详细信息');
    console.log(`\n   示例: GET /api/line-stops/${eventIds[0]}/summary`);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
