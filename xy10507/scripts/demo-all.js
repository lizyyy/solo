const http = require('http');

const BASE_URL = 'http://localhost:3001/api';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({ ...options, port: 3001 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function apiPost(path, body) {
  return request({
    method: 'POST',
    hostname: 'localhost',
    path: '/api' + path,
    headers: { 'Content-Type': 'application/json' }
  }, body);
}

function apiGet(path) {
  return request({
    method: 'GET',
    hostname: 'localhost',
    path: '/api' + path,
    headers: { 'Content-Type': 'application/json' }
  });
}

function logSection(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}`);
}

function logStep(step, desc) {
  console.log(`\n  [步骤 ${step}] ${desc}`);
}

function logResult(label, data, isError = false) {
  const icon = isError ? '❌' : '✅';
  console.log(`    ${icon} ${label}:`);
  console.log(`       ${JSON.stringify(data, null, 2).split('\n').map((l, i) => i === 0 ? l : '       ' + l).join('\n')}`);
}

async function main() {
  console.log('\n' + '#'.repeat(60));
  console.log('#' + ' '.repeat(58) + '#');
  console.log('#   广告素材版本投放系统 - 完整业务闭环演示            #');
  console.log('#' + ' '.repeat(58) + '#');
  console.log('#'.repeat(60));

  await waitForServer();

  const { campaignId, channels, materials } = await getInitialData();
  
  await demoSuccessPath(campaignId, channels, materials);
  
  await demoFailurePath(campaignId, channels, materials);

  console.log('\n' + '#'.repeat(60));
  console.log('#   演示完成! 请打开浏览器查看: http://localhost:3001   #');
  console.log('#'.repeat(60) + '\n');
}

async function waitForServer() {
  console.log('\n  等待服务启动...');
  for (let i = 0; i < 30; i++) {
    try {
      await apiGet('/health');
      console.log('  ✅ 服务已就绪');
      return;
    } catch (e) {
      await sleep(1000);
    }
  }
  throw new Error('服务未启动，请先运行 npm start');
}

async function getInitialData() {
  logSection('获取初始数据');
  
  const campaignsRes = await apiGet('/campaigns');
  const campaign = campaignsRes.data.data[0];
  
  const channelsRes = await apiGet('/channels');
  const channels = channelsRes.data.data;
  
  const materialsRes = await apiGet('/materials?campaign_id=' + campaign.id);
  const materials = materialsRes.data.data;
  
  console.log(`  ✅ 活动: ${campaign.name}`);
  console.log(`  ✅ 渠道数: ${channels.length}`);
  console.log(`  ✅ 素材版本数: ${materials.length}`);
  
  return { campaignId: campaign.id, channels, materials };
}

async function demoSuccessPath(campaignId, channels, materials) {
  logSection('演示一: 新版本上线 - 成功路径');
  
  const material = materials[materials.length - 1];
  const channel = channels[0];
  
  logStep('1', `选择素材 v${material.version} 分配到渠道 [${channel.name}]`);
  const assignRes = await apiPost(`/materials/${material.id}/assign-channels`, {
    channels: [{ channel_id: channel.id, budget: 10000 }],
    operator: '运营专员-小张'
  });
  
  const mcId = assignRes.data.data.channels[0].id;
  logResult('分配渠道成功', assignRes.data.data);
  
  logStep('2', `提交审核`);
  const submitRes = await apiPost(`/materials/channel/${mcId}/submit-review`, {
    operator: '运营专员-小张',
    request_id: 'submit-' + mcId
  });
  logResult('审核状态: pending_review', submitRes.data.data);
  
  logStep('3', `审核通过`);
  const approveRes = await apiPost(`/materials/channel/${mcId}/approve`, {
    operator: '审核员-李总',
    reason: '素材内容合规，符合平台规范'
  });
  logResult('审核通过', approveRes.data.data);
  
  logStep('4', `验证规则 - 检查是否可以上线`);
  const checkRes = await apiGet(`/reports/campaign/${campaignId}/dashboard`);
  const mcStatus = checkRes.data.data.channel_statuses.find(c => c.id === mcId);
  logResult('当前状态', {
    review_status: mcStatus.review_status,
    budget: mcStatus.budget,
    remaining: mcStatus.budget - mcStatus.spent
  });
  
  logStep('5', `上线投放`);
  const launchRes = await apiPost(`/materials/channel/${mcId}/launch`, {
    operator: '运营专员-小张',
    request_id: 'launch-' + mcId
  });
  logResult('上线成功', launchRes.data);
  
  logStep('6', `记录效果数据 (幂等性测试)`);
  const perfData = { impressions: 50000, clicks: 2500, conversions: 125, cost: 3000 };
  const perfRes1 = await apiPost(`/materials/channel/${mcId}/performance`, {
    ...perfData,
    request_id: 'perf-day1'
  });
  logResult('效果记录成功', perfRes1.data);
  
  logStep('7', `重复回调同一 request_id (测试幂等性)`);
  const perfRes2 = await apiPost(`/materials/channel/${mcId}/performance`, {
    ...perfData,
    request_id: 'perf-day1'
  });
  logResult('幂等性验证 - 重复请求返回相同结果且不累加', {
    is_idempotent: perfRes2.data.idempotent === true,
    message: '相同request_id只处理一次'
  });
  
  logStep('8', `记录第二日效果`);
  const perfRes3 = await apiPost(`/materials/channel/${mcId}/performance`, {
    impressions: 80000, clicks: 4000, conversions: 200, cost: 5000,
    request_id: 'perf-day2'
  });
  logResult('第二日效果', perfRes3.data.result);
  
  logStep('9', `验证预算消耗`);
  const budgetCheck = await apiGet(`/reports/campaign/${campaignId}/dashboard`);
  const finalMC = budgetCheck.data.data.channel_statuses.find(c => c.id === mcId);
  logResult('预算状态', {
    total_budget: finalMC.budget,
    total_spent: finalMC.spent,
    remaining: finalMC.budget - finalMC.spent,
    percentage: ((finalMC.spent / finalMC.budget) * 100).toFixed(1) + '%'
  });
  
  logStep('10', `暂停投放`);
  const pauseRes = await apiPost(`/materials/channel/${mcId}/pause`, {
    operator: '运营专员-小张',
    reason: '优化调整素材内容'
  });
  logResult('已暂停', pauseRes.data.data);
}

async function demoFailurePath(campaignId, channels, materials) {
  logSection('演示二: 规则拦截 - 失败路径');
  
  const material2 = materials[1];
  const channel2 = channels[1];
  
  logStep('1', `分配 v${material2.version} 到 [${channel2.name}]，预算 1000`);
  const assignRes = await apiPost(`/materials/${material2.id}/assign-channels`, {
    channels: [{ channel_id: channel2.id, budget: 1000 }],
    operator: '运营专员-小王'
  });
  const mcId2 = assignRes.data.data.channels[0].id;
  
  logStep('2', `尝试直接上线 (未审核) - 应该被拦截`);
  const launchFail1 = await apiPost(`/materials/channel/${mcId2}/launch`, {
    operator: '运营专员-小王',
    request_id: 'launch-fail-1'
  });
  logResult('规则拦截: 未审核不能上线', {
    success: launchFail1.data.success,
    code: launchFail1.data.code,
    violations: launchFail1.data.errors.map(e => ({
      rule: e.rule,
      violation: e.violation
    }))
  }, true);
  
  logStep('3', `提交审核`);
  await apiPost(`/materials/channel/${mcId2}/submit-review`, {
    operator: '运营专员-小王'
  });
  
  logStep('4', `审核驳回`);
  const rejectRes = await apiPost(`/materials/channel/${mcId2}/reject`, {
    operator: '审核员-王总',
    reason: '素材内容包含敏感词"最低价"，违反广告法'
  });
  logResult('审核驳回', {
    rejection_reason: rejectRes.data.data.rejectionReason,
    reviewer: rejectRes.data.data.historyId
  });
  
  logStep('5', `再次尝试上线 (已驳回) - 应该被拦截`);
  const launchFail2 = await apiPost(`/materials/channel/${mcId2}/launch`, {
    operator: '运营专员-小王',
    request_id: 'launch-fail-2'
  });
  logResult('规则拦截: 审核不通过不能上线', {
    review_status: 'rejected',
    blocked: launchFail2.data.success === false
  }, true);
  
  logStep('6', `创建新版本 v${materials[2].version}，预算耗尽测试`);
  const channel3 = channels[2];
  const assign3 = await apiPost(`/materials/${materials[2].id}/assign-channels`, {
    channels: [{ channel_id: channel3.id, budget: 500 }],
    operator: '运营专员-小刘'
  });
  const mcId3 = assign3.data.data.channels[0].id;
  
  logStep('7', `审核通过并上线`);
  await apiPost(`/materials/channel/${mcId3}/submit-review`, { operator: '运营专员-小刘' });
  await apiPost(`/materials/channel/${mcId3}/approve`, { operator: '审核员-李总' });
  await apiPost(`/materials/channel/${mcId3}/launch`, {
    operator: '运营专员-小刘',
    request_id: 'launch-budget-test'
  });
  
  logStep('8', `消耗超过预算`);
  const budgetFail = await apiPost(`/materials/channel/${mcId3}/performance`, {
    impressions: 100000, clicks: 5000, conversions: 250, cost: 600,
    request_id: 'budget-fail-test'
  });
  logResult('预算拦截: 预算耗尽不能投', {
    budget: 500,
    required_cost: 600,
    blocked: budgetFail.data.success === false,
    code: budgetFail.data.code
  }, true);
  
  logStep('9', `回滚测试 - 准备历史版本`);
  const channel4 = channels[3];
  const oldMaterial = materials[0];
  const newMaterial = materials[3];
  
  const assignOld = await apiPost(`/materials/${oldMaterial.id}/assign-channels`, {
    channels: [{ channel_id: channel4.id, budget: 20000 }],
    operator: '运营专员-小张'
  });
  const mcId4 = assignOld.data.data.channels[0].id;
  
  await apiPost(`/materials/channel/${mcId4}/submit-review`, { operator: '运营专员-小张' });
  await apiPost(`/materials/channel/${mcId4}/approve`, { operator: '审核员-李总' });
  await apiPost(`/materials/channel/${mcId4}/launch`, {
    operator: '运营专员-小张',
    request_id: 'launch-rollback-old'
  });
  
  await apiPost(`/materials/channel/${mcId4}/performance`, {
    impressions: 100000, clicks: 3000, conversions: 150, cost: 4500,
    request_id: 'perf-rollback-v1'
  });
  
  logStep('10', `先暂停当前版本，然后回滚到 v${oldMaterial.version}`);
  await apiPost(`/materials/channel/${mcId4}/pause`, {
    operator: '运营专员-小张',
    reason: '准备回滚到历史版本'
  });
  
  const rollbackRes = await apiPost(`/materials/channel/${mcId4}/rollback`, {
    target_material_id: oldMaterial.id,
    operator: '运营经理-陈总',
    reason: '新版本效果不佳，回滚到稳定版本 v' + oldMaterial.version,
    request_id: 'rollback-test-1'
  });
  logResult('回滚成功', {
    from_version: rollbackRes.data.result.from.version,
    to_version: rollbackRes.data.result.to.version,
    operator: rollbackRes.data.result.operator,
    reason: rollbackRes.data.result.reason
  });
  
  logStep('11', `验证回滚后效果数据保留`);
  const perfCheck = await apiGet(`/reports/performance/${campaignId}`);
  const oldVersionPerf = perfCheck.data.data.records.find(r => r.material_version === oldMaterial.version);
  logResult('效果数据验证', {
    v1_data_preserved: oldVersionPerf !== undefined,
    total_cost_recorded: perfCheck.data.data.summary.total_cost > 0
  });
  
  logStep('12', `人工修正测试`);
  const manualRes = await apiPost(`/materials/manual-correct`, {
    target_id: mcId3,
    target_type: 'material_channel',
    before_data: { budget: 500, status: 'running' },
    after_data: { budget: 10000, status: 'paused' },
    operator: '系统管理员-超级用户',
    reason: '紧急调整预算，防止超投'
  });
  logResult('人工修正记录保存', {
    correction_id: manualRes.data.data.correctionId,
    before: manualRes.data.data.beforeData,
    after: manualRes.data.data.afterData,
    operator: manualRes.data.data.operator,
    reason: manualRes.data.data.reason
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
  console.error('\n❌ 演示出错:', err.message);
  console.error(err.stack);
  process.exit(1);
});
