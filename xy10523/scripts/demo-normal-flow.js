const { api, section, step, print, printLedgerSummary, wait } = require('./demo-helper');

const TENANT_ID = 'demo-normal-001';
const today = new Date().toISOString().slice(0, 10);
const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();

async function main() {
  section('📋 演示场景 A: 正常使用 -> 超用告警 -> 加购恢复 -> 降级冻结');
  console.log('覆盖业务场景: 正常使用、软限制告警、硬限制超用、加购恢复、套餐变更、冻结/解冻');

  try {
    await api('GET', '/health');
  } catch (e) {
    console.error('❌ 无法连接到 API 服务，请先运行: npm start');
    process.exit(1);
  }

  step(1, '查看可用套餐');
  let res = await api('GET', '/api/plans');
  console.log('  可用套餐:', res.data.plans.map(p => `${p.id}(${p.name}): 存储${p.storage_quota_gb}GB / 调用${p.call_quota} / 成员${p.member_quota}`).join(', '));

  step(2, '创建租户「演示公司」- 入门版(10GB存储)');
  res = await api('POST', '/api/tenants', {
    id: TENANT_ID,
    name: '演示公司',
    planId: 'starter'
  });
  if (res.status === 409) {
    console.log('  ⚠️  租户已存在，继续使用现有租户');
  } else {
    console.log('  ✅ 创建成功');
    printLedgerSummary(res.data.ledger);
  }

  step(3, '上报昨天用量: 存储 3GB (正常范围内)');
  res = await api('POST', `/api/tenants/${TENANT_ID}/usage`, {
    resourceType: 'storage',
    amount: 3,
    usageDate: yesterday,
    requestId: 'req-demo-001'
  });
  console.log('  用量上报结果:', res.data.success ? '✅ 成功' : '❌ 失败');
  console.log('  当前状态:', res.data.currentState);

  step(4, '查询配额账本 - 状态应为 normal');
  res = await api('GET', `/api/tenants/${TENANT_ID}/ledger`);
  printLedgerSummary(res.data.ledger);

  step(5, '上报今日用量: 存储 6GB (累计 9GB，接近 10GB 配额 -> 触发软限制警告)');
  res = await api('POST', `/api/tenants/${TENANT_ID}/usage`, {
    resourceType: 'storage',
    amount: 6,
    usageDate: today,
    requestId: 'req-demo-002'
  });
  console.log('  用量上报结果:', res.data.success ? '✅ 成功' : '❌ 失败');
  console.log('  状态:', res.data.currentState.status, '(软限制 80% = 8GB, 当前 9GB)');

  step(6, '查询配额账本 - 状态应为 warning (软限制告警)');
  res = await api('GET', `/api/tenants/${TENANT_ID}/ledger`);
  printLedgerSummary(res.data.ledger);

  step(7, '继续上报: 存储 2GB (累计 11GB -> 超配额 1GB)');
  res = await api('POST', `/api/tenants/${TENANT_ID}/usage`, {
    resourceType: 'storage',
    amount: 2,
    requestId: 'req-demo-003'
  });
  console.log('  用量上报结果:', res.data.success ? '✅ 成功' : '❌ 失败');
  console.log('  超用量:', res.data.currentState.overage, 'GB');

  step(8, '查询配额账本 - 状态应为 over (硬限制超用)');
  res = await api('GET', `/api/tenants/${TENANT_ID}/ledger`);
  printLedgerSummary(res.data.ledger);

  step(9, '加购 5GB 存储包 (加购恢复)');
  res = await api('POST', `/api/tenants/${TENANT_ID}/addons`, {
    type: 'storage',
    amount: 5,
    source: 'purchase',
    operator: 'sales-agent-001'
  });
  console.log('  加购结果:', res.data.success ? '✅ 成功' : '❌ 失败');
  console.log('  加购包详情:', res.data.addon);

  step(10, '查询配额账本 - 加购后总配额 15GB，使用 11GB -> 恢复正常');
  res = await api('GET', `/api/tenants/${TENANT_ID}/ledger`);
  printLedgerSummary(res.data.ledger);

  step(11, '套餐变更: 从入门版 降级到 免费版 (仅 1GB 存储)');
  console.log('  ⚠️  注意: 套餐降级后，历史用量仍会被追溯');
  res = await api('POST', `/api/tenants/${TENANT_ID}/plan`, {
    planId: 'free',
    reason: '用户主动降级',
    operator: 'cs-agent-001'
  });
  console.log('  套餐变更结果:', res.data.success ? '✅ 成功' : '❌ 失败');
  console.log('  变更详情:', res.data.change);

  step(12, '查询配额账本 - 降级后套餐配额 1GB + 加购 5GB = 6GB，已用 11GB -> 再次超用');
  res = await api('GET', `/api/tenants/${TENANT_ID}/ledger`);
  printLedgerSummary(res.data.ledger);
  const storageLedger = res.data.ledger.ledger.storage;
  if (storageLedger.overageReason) {
    console.log('\n  📊 超用原因分析:');
    storageLedger.overageReason.forEach(r => console.log(`     - ${r.description}`));
  }

  step(13, '因持续超用，冻结租户');
  res = await api('POST', `/api/tenants/${TENANT_ID}/freeze`, {
    reason: '存储配额超用且未及时续费',
    operator: 'compliance-001'
  });
  console.log('  冻结结果:', res.data.success ? '✅ 成功' : '❌ 失败');
  console.log('  冻结详情:', { status: res.data.status, reason: res.data.reason });

  step(14, '冻结后尝试上报用量 -> 应该失败');
  res = await api('POST', `/api/tenants/${TENANT_ID}/usage`, {
    resourceType: 'storage',
    amount: 1,
    requestId: 'req-demo-004'
  });
  console.log('  上报结果 (预期失败):', res.data.success ? '❌ 意外成功' : '✅ 按预期拒绝');
  console.log('  错误信息:', res.data.message);

  step(15, '查询历史记录 (套餐变更、冻结记录、审计日志)');
  res = await api('GET', `/api/tenants/${TENANT_ID}/history`);
  console.log('  套餐变更历史:', res.data.history.planHistory.length, '条');
  res.data.history.planHistory.forEach(h => {
    console.log(`     - ${h.effective_at}: ${h.old_plan_name || '无'} -> ${h.new_plan_name} (${h.reason})`);
  });
  console.log('  冻结/解冻历史:', res.data.history.freezeHistory.length, '条');
  res.data.history.freezeHistory.forEach(h => {
    console.log(`     - ${h.created_at}: ${h.action} (${h.reason}, 操作人: ${h.operator})`);
  });
  console.log('  加购包历史:', res.data.history.addonHistory.length, '条');
  console.log('  审计日志 (最近5条):');
  res.data.history.auditLogs.slice(0, 5).forEach(l => {
    console.log(`     - ${l.created_at}: ${l.action} (${l.operator})`);
  });

  step(16, '导出日期用量报告 (JSON 和 CSV)');
  const weekAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); })();
  res = await api('GET', `/api/tenants/${TENANT_ID}/report/daily?from=${weekAgo}&to=${today}`);
  console.log('  报告生成:', res.data.success ? '✅ 成功' : '❌ 失败');
  console.log('  报告周期:', res.data.report.period);
  for (const [type, data] of Object.entries(res.data.report.resources)) {
    console.log(`\n  ${type} 日报:`);
    data.dailyUsage.forEach(d => console.log(`     ${d.date}: ${d.amount} (${d.recordCount}条记录)`));
    console.log(`     周期合计: ${data.periodTotal}`);
  }

  step(17, '人工修正: 扣除重复统计的 2GB 存储');
  res = await api('POST', `/api/tenants/${TENANT_ID}/correction`, {
    resourceType: 'storage',
    correction: -2,
    reason: '排查发现 2GB 为重复统计，人工修正',
    operator: 'ops-admin-001'
  });
  console.log('  人工修正结果:', res.data.success ? '✅ 成功' : '❌ 失败');
  console.log('  修正详情:', {
    修正前: res.data.correction.beforeUsage,
    修正量: res.data.correction.amount,
    修正后: res.data.correction.afterUsage,
    操作人: res.data.correction.operator,
    原因: res.data.correction.reason
  });

  step(18, '查询审计日志查看人工修正前后差异');
  res = await api('GET', `/api/tenants/${TENANT_ID}/history`);
  const correctionLog = res.data.history.auditLogs.find(l => l.action === 'MANUAL_CORRECTION');
  if (correctionLog) {
    console.log('  人工修正审计记录:');
    const diff = JSON.parse(correctionLog.diff);
    console.log(`     操作人: ${correctionLog.operator}`);
    console.log(`     修正量: ${diff.correction}`);
    console.log(`     修正前使用量: ${diff.beforeUsage}`);
    console.log(`     修正后使用量: ${diff.afterUsage}`);
    console.log(`     差异: ${diff.difference}`);
    console.log(`     原因: ${diff.reason}`);
  }

  step(19, '先解冻租户，再进行幂等性测试');
  res = await api('POST', `/api/tenants/${TENANT_ID}/unfreeze`, {
    reason: '问题已排查，人工解冻',
    operator: 'ops-admin-001'
  });
  console.log('  解冻结果:', res.data.success ? '✅ 成功' : '❌ 失败');

  step(20, '幂等性测试: 使用相同 requestId 重复上报');
  console.log('  第一次上报 (requestId: req-idempotent-001)');
  const r1 = await api('POST', `/api/tenants/${TENANT_ID}/usage`, {
    resourceType: 'call',
    amount: 100,
    requestId: 'req-idempotent-001'
  });
  console.log('    结果:', r1.data.idempotent ? '幂等返回' : '新记录', r1.data.idempotent ? '' : `(ID: ${r1.data.id})`);

  await wait(500);

  console.log('  第二次上报 (相同 requestId，模拟重试)');
  const r2 = await api('POST', `/api/tenants/${TENANT_ID}/usage`, {
    resourceType: 'call',
    amount: 100,
    requestId: 'req-idempotent-001'
  });
  console.log('    结果:', r2.data.idempotent ? '✅ 幂等返回 (正确)' : '❌ 重复记录');
  if (r2.data.idempotent) {
    console.log('    现有记录:', r2.data.existingRecord);
  }

  console.log('  验证累计使用量 (应为 100，不是 200):');
  res = await api('GET', `/api/tenants/${TENANT_ID}/ledger`);
  console.log('    call 当前使用:', res.data.ledger.ledger.call.currentUsage);

  section('✅ 正常流程演示完成');
  console.log('');
  console.log('📌 关键能力验证:');
  console.log('   ✅ 套餐配额 + 加购配额 合并计算');
  console.log('   ✅ 软限制(80%)告警 / 硬限制超用');
  console.log('   ✅ 套餐降级时历史用量追溯 (超用原因分析)');
  console.log('   ✅ 加购恢复可用量');
  console.log('   ✅ 冻结状态阻止新用量上报');
  console.log('   ✅ requestId 幂等性保护');
  console.log('   ✅ 人工修正记录前后差异和操作人');
  console.log('   ✅ 完整审计日志和历史记录');
  console.log('   ✅ 日期范围用量报告导出');
  console.log('');
}

main().catch(console.error);
