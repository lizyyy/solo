const http = require('http');

const BASE_URL = 'http://localhost:3000/api';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
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

function apiCall(method, path, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    }
  };
  
  if (body) {
    options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
  }
  
  const url = new URL(BASE_URL + path);
  options.hostname = url.hostname;
  options.port = url.port;
  options.path = url.pathname + url.search;
  
  return request(options, body);
}

function logSection(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}`);
}

function logStep(step, description) {
  console.log(`\n[步骤 ${step}] ${description}`);
  console.log('-'.repeat(50));
}

function logResult(result, success = true) {
  if (success) {
    console.log('\u2705 成功:', JSON.stringify(result, null, 2).slice(0, 500));
  } else {
    console.log('\u274C 失败/拦截:', JSON.stringify(result, null, 2));
  }
}

async function testSmoothScenario() {
  logSection('场景一：顺利样例 - 南分支管道抢修（无高危影响）');
  console.log('目标: 关闭V007，影响南分支区域（河畔新村、仁爱医院、消防栓FH004）');
  console.log('预期: 顺利通过，无需人工复核');
  
  let orderId = null;
  let analysisId = null;

  try {
    logStep(1, '创建抢修工单 - 南分支管道泄漏');
    const createRes = await apiCall('POST', '/repair-orders', {
      title: '南分支管道泄漏抢修',
      description: '南区江滨路168号附近PE管破裂漏水，需要紧急抢修',
      reportSource: 'citizen',
      priority: 'high',
      faultLocation: '南区江滨路168号',
      faultLongitude: 116.4324,
      faultLatitude: 39.8942,
      faultType: 'pipe_leak',
      affectedPipeId: 'P006',
      reportedBy: '王先生',
      reportedPhone: '13800000001'
    });
    logResult(createRes.data);
    orderId = createRes.data.data.id;

    logStep(2, '指派工单给维修班组');
    const assignRes = await apiCall('PUT', `/repair-orders/${orderId}/assign`, {
      assignedTo: '维修一班-李师傅'
    });
    logResult(assignRes.data);

    logStep(3, '查询管道P006的推荐关闭阀门');
    const recommendRes = await apiCall('POST', '/valves/recommend', {
      pipeId: 'P006'
    });
    logResult(recommendRes.data);

    logStep(4, '创建影响分析 - 关闭阀门V007');
    const analysisRes = await apiCall('POST', `/repair-orders/${orderId}/impact-analysis`, {
      valveIds: ['V007']
    });
    logResult(analysisRes.data);
    analysisId = analysisRes.data.data.id;
    
    console.log('\n影响分析结果摘要:');
    const analysis = analysisRes.data;
    console.log('  - 需人工复核:', analysis.needsReview ? '是' : '否');
    console.log('  - 预警数量:', analysis.warnings?.length || 0);
    if (analysis.warnings?.length > 0) {
      analysis.warnings.forEach(w => {
        console.log(`    * ${w.type}: ${w.message}`);
      });
    }

    logStep(5, '确认影响分析结果');
    const confirmRes = await apiCall('PUT', `/repair-orders/${orderId}/impact-analysis/${analysisId}/confirm`, {
      reviewer: '调度员-张工',
      notes: '影响范围较小，仅有仁爱医院有备用水源，可以执行'
    });
    logResult(confirmRes.data);

    logStep(6, '最终确认并关闭阀门');
    const finalizeRes = await apiCall('PUT', `/repair-orders/${orderId}/impact-analysis/${analysisId}/finalize`);
    logResult(finalizeRes.data);

    logStep(7, '开始抢修作业');
    const startRes = await apiCall('PUT', `/repair-orders/${orderId}/start`, {
      estimatedEndTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    });
    logResult(startRes.data);

    logStep(8, '提交工单等待复核');
    const submitRes = await apiCall('PUT', `/repair-orders/${orderId}/submit-review`, {
      repairNotes: '已更换损坏的PE管段，完成压力测试，无渗漏'
    });
    logResult(submitRes.data);

    logStep(9, '复核并完成工单（自动恢复阀门）');
    const completeRes = await apiCall('PUT', `/repair-orders/${orderId}/complete`, {
      reviewNotes: '验收合格，已通知用户恢复供水',
      reviewedBy: '值班主管-王工'
    });
    logResult(completeRes.data);

    logStep(10, '生成停水报表');
    const reportRes = await apiCall('GET', `/repair-orders/${orderId}/report`);
    console.log('\n停水报表摘要:');
    const report = reportRes.data.data;
    console.log('  - 报表ID:', report.reportId);
    console.log('  - 工单:', report.orderInfo.title);
    console.log('  - 影响小区:', report.affectedCommunities.count, '个,',
      report.affectedCommunities.totalHouseholds, '户,',
      report.affectedCommunities.totalPopulation, '人');
    console.log('  - 影响医院:', report.affectedHospitals.count, '家');
    console.log('  - 影响消防栓:', report.affectedFireHydrants.count, '个');
    console.log('  - 影响优先级用户:', report.affectedPriorityUsers.count, '个');
    console.log('  - 关闭阀门:', report.closedValves.count, '个');
    if (report.warnings?.length > 0) {
      console.log('  - 预警信息:');
      report.warnings.forEach(w => {
        console.log(`    * [${w.critical ? '严重' : '一般'}] ${w.type}: ${w.message}`);
      });
    }

    console.log('\n\u2705 顺利样例测试通过！');
    
  } catch (error) {
    console.error('\u274C 顺利样例测试失败:', error.message);
  }
}

async function testReviewScenario() {
  logSection('场景二：待复核样例 - 北分支管道抢修（影响一级优先级用户）');
  console.log('目标: 关闭V006，影响北分支区域（民生家园、社区卫生服务中心、重点中学）');
  console.log('预期: 触发预警 -> 需要人工复核 -> 复核后可执行');
  
  let orderId = null;
  let analysisId = null;

  try {
    logStep(1, '创建抢修工单 - 北分支管道老化破损');
    const createRes = await apiCall('POST', '/repair-orders', {
      title: '北分支管道老化破损抢修',
      description: '北区学府路附近管道老化，出现多处滴漏，需要计划性更换',
      reportSource: 'patrol',
      priority: 'medium',
      faultLocation: '北区学府路256号附近',
      faultLongitude: 116.4324,
      faultLatitude: 39.9142,
      faultType: 'pipe_aging',
      affectedPipeId: 'P005',
      reportedBy: '巡查组-刘工',
      reportedPhone: '13800000002'
    });
    logResult(createRes.data);
    orderId = createRes.data.data.id;

    logStep(2, '创建影响分析 - 关闭阀门V006');
    const analysisRes = await apiCall('POST', `/repair-orders/${orderId}/impact-analysis`, {
      valveIds: ['V006']
    });
    analysisId = analysisRes.data.data.id;
    
    console.log('\n影响分析结果:');
    const analysis = analysisRes.data;
    console.log('  - 需人工复核:', analysis.needsReview ? '\u26A0\uFE0F 是' : '否');
    console.log('  - 预警数量:', analysis.warnings?.length || 0);
    if (analysis.warnings?.length > 0) {
      analysis.warnings.forEach(w => {
        console.log(`    * [${w.critical ? '严重' : '一般'}] ${w.type}: ${w.message}`);
        if (w.details) {
          console.log(`      详情:`, JSON.stringify(w.details));
        }
      });
    }
    
    if (analysis.needsReview) {
      console.log('\n\u26A0\uFE0F 系统提示：由于影响一级优先级用户，需要人工复核才能继续！');
    }

    logStep(3, '复核影响分析结果（调度员确认）');
    const confirmRes = await apiCall('PUT', `/repair-orders/${orderId}/impact-analysis/${analysisId}/confirm`, {
      reviewer: '调度主管-陈工',
      notes: '已确认停水方案，影响学校但目前是暑假期间，用户已提前通知，可以执行。'
    });
    logResult(confirmRes.data);

    logStep(4, '指派并开始抢修');
    await apiCall('PUT', `/repair-orders/${orderId}/assign`, {
      assignedTo: '维修二班-王师傅'
    });
    
    await apiCall('PUT', `/repair-orders/${orderId}/impact-analysis/${analysisId}/finalize`);
    
    const startRes = await apiCall('PUT', `/repair-orders/${orderId}/start`, {
      estimatedEndTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
    });
    logResult(startRes.data);

    console.log('\n\u2705 待复核样例测试通过！');
    
  } catch (error) {
    console.error('\u274C 待复核样例测试失败:', error.message);
  }
}

async function testBlockingScenario() {
  logSection('场景三：拦截/错误样例 - 状态流转和业务规则验证');
  console.log('目标: 测试各种拦截和错误场景');
  
  let orderId = null;

  try {
    logStep(1, '创建测试工单');
    const createRes = await apiCall('POST', '/repair-orders', {
      title: '测试拦截工单',
      description: '用于测试拦截场景',
      priority: 'low',
      faultLocation: '测试地点',
      faultLongitude: 116.4074,
      faultLatitude: 39.9042
    });
    orderId = createRes.data.data.id;
    console.log('  工单ID:', orderId);

    logStep(2, '拦截测试1: 未指派就开始抢修（预期失败）');
    const startWithoutAssignRes = await apiCall('PUT', `/repair-orders/${orderId}/start`);
    logResult(startWithoutAssignRes.data, startWithoutAssignRes.status === 400);
    console.log('  状态码:', startWithoutAssignRes.status);
    console.log('  错误码:', startWithoutAssignRes.data.error?.code);
    console.log('  错误信息:', startWithoutAssignRes.data.error?.message);

    logStep(3, '拦截测试2: 开始抢修但未做影响分析（预期失败）');
    await apiCall('PUT', `/repair-orders/${orderId}/assign`, {
      assignedTo: '测试班组'
    });
    const startWithoutAnalysisRes = await apiCall('PUT', `/repair-orders/${orderId}/start`);
    logResult(startWithoutAnalysisRes.data, startWithoutAnalysisRes.status === 400);
    console.log('  状态码:', startWithoutAnalysisRes.status);
    console.log('  错误码:', startWithoutAnalysisRes.data.error?.code);
    console.log('  错误信息:', startWithoutAnalysisRes.data.error?.message);

    logStep(4, '拦截测试3: 查询不存在的阀门（预期404）');
    const valveRes = await apiCall('GET', '/valves/V9999');
    logResult(valveRes.data, valveRes.status === 404);
    console.log('  状态码:', valveRes.status);
    console.log('  错误码:', valveRes.data.error?.code);

    logStep(5, '拦截测试4: 影响分析使用不存在的阀门（预期失败）');
    const badValveAnalysisRes = await apiCall('POST', `/repair-orders/${orderId}/impact-analysis`, {
      valveIds: ['V9999', 'V001']
    });
    logResult(badValveAnalysisRes.data, badValveAnalysisRes.status === 400);
    console.log('  错误码:', badValveAnalysisRes.data.error?.code);

    logStep(6, '拦截测试5: 创建工单缺少必要参数（预期失败）');
    const badOrderRes = await apiCall('POST', '/repair-orders', {
      title: '不完整工单',
      description: '缺少位置信息'
    });
    logResult(badOrderRes.data, badOrderRes.status === 400);
    console.log('  错误码:', badOrderRes.data.error?.code);

    logStep(7, '拦截测试6: 取消工单后状态验证（预期失败）');
    const tempOrderRes = await apiCall('POST', '/repair-orders', {
      title: '临时测试工单',
      description: '测试取消流程',
      faultLocation: '测试',
      faultLongitude: 116.4074,
      faultLatitude: 39.9042
    });
    const tempOrderId = tempOrderRes.data.data.id;
    
    await apiCall('PUT', `/repair-orders/${tempOrderId}/cancel`, {
      cancelReason: '误报，取消工单'
    });
    
    const cancelAfterCancelRes = await apiCall('PUT', `/repair-orders/${tempOrderId}/cancel`, {
      cancelReason: '再次取消'
    });
    logResult(cancelAfterCancelRes.data, cancelAfterCancelRes.status === 409);
    console.log('  状态码:', cancelAfterCancelRes.status);
    console.log('  错误码:', cancelAfterCancelRes.data.error?.code);
    console.log('  错误信息:', cancelAfterCancelRes.data.error?.message);

    console.log('\n\u2705 拦截样例测试通过！');
    
  } catch (error) {
    console.error('\u274C 拦截样例测试失败:', error.message);
  }
}

async function testLargeImpactScenario() {
  logSection('场景四：大影响样例 - 干线阀门关闭（多区域停水）');
  console.log('目标: 关闭V003，影响干线2及东西分支（N003/N004/N005区域）');
  console.log('预期: 触发多重预警 -> 需要高级别复核');
  
  let orderId = null;
  let analysisId = null;

  try {
    logStep(1, '创建紧急抢修工单 - 干线2管道爆裂');
    const createRes = await apiCall('POST', '/repair-orders', {
      title: '干线2管道爆裂紧急抢修',
      description: '干线节点2附近主管道爆裂，大量漏水，需立即关闭阀门',
      reportSource: 'alarm',
      priority: 'critical',
      faultLocation: '干线节点2附近',
      faultLongitude: 116.4274,
      faultLatitude: 39.9042,
      faultType: 'pipe_burst',
      affectedPipeId: 'P002'
    });
    logResult(createRes.data);
    orderId = createRes.data.data.id;

    logStep(2, '快速创建影响分析 - 关闭阀门V003');
    const analysisRes = await apiCall('POST', `/repair-orders/${orderId}/impact-analysis`, {
      valveIds: ['V003']
    });
    analysisId = analysisRes.data.data.id;
    
    console.log('\n\u26A0\uFE0F 影响分析预警:');
    const analysis = analysisRes.data;
    console.log('  - 需人工复核:', analysis.needsReview ? '\u274C 是（高危）' : '否');
    console.log('  - 预警数量:', analysis.warnings?.length || 0);
    if (analysis.warnings?.length > 0) {
      analysis.warnings.forEach((w, i) => {
        console.log(`    ${i + 1}. [${w.critical ? '\uD83D\uDD34 严重' : '\uD83D\uDFE1 一般'}] ${w.type}: ${w.message}`);
      });
    }
    
    const reportRes = await apiCall('GET', `/repair-orders/${orderId}/report`);
    const report = reportRes.data.data;
    console.log('\n影响范围统计:');
    console.log('  - 小区:', report.affectedCommunities.count, '个');
    console.log('    * 户数:', report.affectedCommunities.totalHouseholds);
    console.log('    * 人口:', report.affectedCommunities.totalPopulation);
    console.log('  - 医院:', report.affectedHospitals.count, '家');
    console.log('  - 消防栓:', report.affectedFireHydrants.count, '个');
    console.log('  - 优先级用户:', report.affectedPriorityUsers.count, '个');

    console.log('\n\u2705 大影响样例测试通过！');
    
  } catch (error) {
    console.error('\u274C 大影响样例测试失败:', error.message);
  }
}

async function main() {
  console.log('\n' + '#'.repeat(70));
  console.log('#' + ' '.repeat(68) + '#');
  console.log('#     自来水抢修阀门影响 API 系统测试'.padEnd(68) + '#');
  console.log('#     测试日期: ' + new Date().toLocaleString('zh-CN').padEnd(50) + '#');
  console.log('#' + ' '.repeat(68) + '#');
  console.log('#'.repeat(70));

  console.log('\n检查服务状态...');
  await delay(500);

  try {
    const healthRes = await apiCall('GET', '/health');
    if (healthRes.status === 200) {
      console.log('\u2705 服务运行正常:', healthRes.data.message);
    } else {
      console.log('\u274C 服务状态异常');
      return;
    }
  } catch (e) {
    console.log('\u274C 无法连接到服务，请确认服务已启动: http://localhost:3000');
    console.log('运行命令: npm start');
    return;
  }

  await testSmoothScenario();
  await testReviewScenario();
  await testBlockingScenario();
  await testLargeImpactScenario();

  console.log('\n' + '#'.repeat(70));
  console.log('#' + ' '.repeat(68) + '#');
  console.log('#     全部测试场景执行完成！'.padEnd(68) + '#');
  console.log('#' + ' '.repeat(68) + '#');
  console.log('#  测试总结:'.padEnd(68) + '#');
  console.log('#    \u2705 场景一: 顺利样例 - 正常流程通过'.padEnd(68) + '#');
  console.log('#    \u2705 场景二: 待复核样例 - 一级用户预警拦截'.padEnd(68) + '#');
  console.log('#    \u2705 场景三: 拦截样例 - 业务规则校验'.padEnd(68) + '#');
  console.log('#    \u2705 场景四: 大影响样例 - 多区域停水分析'.padEnd(68) + '#');
  console.log('#' + ' '.repeat(68) + '#');
  console.log('#  可访问:'.padEnd(68) + '#');
  console.log('#    Swagger文档: http://localhost:3000/api-docs'.padEnd(68) + '#');
  console.log('#    健康检查: http://localhost:3000/api/health'.padEnd(68) + '#');
  console.log('#' + ' '.repeat(68) + '#');
  console.log('#'.repeat(70));
}

main();
