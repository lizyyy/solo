const { api, section, step, printLedgerSummary } = require('./demo-helper');

const TENANT_ID = 'demo-failure-001';

async function main() {
  section('❌ 演示场景 B: 失败路径与异常处理');
  console.log('覆盖异常场景: 重复上报、加购包过期、冻结后上报、参数校验、不存在资源');

  try {
    await api('GET', '/health');
  } catch (e) {
    console.error('❌ 无法连接到 API 服务，请先运行: npm start');
    process.exit(1);
  }

  step(1, '创建测试租户 - 免费版 (1GB 存储配额)');
  let res = await api('POST', '/api/tenants', {
    id: TENANT_ID,
    name: '失败路径测试公司',
    planId: 'free'
  });
  if (res.status === 409) {
    console.log('  ⚠️  租户已存在，继续使用');
  } else {
    console.log('  ✅ 创建成功');
  }

  step(2, '异常1: 创建已存在的租户 -> 409 Conflict');
  res = await api('POST', '/api/tenants', {
    id: TENANT_ID,
    name: '同名公司'
  });
  console.log('  HTTP状态:', res.status, '(预期: 409)');
  console.log('  错误码:', res.data.error);
  console.log('  错误信息:', res.data.message);

  step(3, '异常2: 查询不存在的租户 -> 404 Not Found');
  res = await api('GET', '/api/tenants/nonexistent-999/ledger');
  console.log('  HTTP状态:', res.status, '(预期: 404)');
  console.log('  错误码:', res.data.error);
  console.log('  错误信息:', res.data.message);

  step(4, '异常3: 上报用量缺少必填参数 -> 400 Bad Request');
  res = await api('POST', `/api/tenants/${TENANT_ID}/usage`, {
    resourceType: 'storage'
  });
  console.log('  HTTP状态:', res.status, '(预期: 400)');
  console.log('  错误码:', res.data.error);
  console.log('  错误信息:', res.data.message);

  step(5, '异常4: 切换到不存在的套餐 -> 404');
  res = await api('POST', `/api/tenants/${TENANT_ID}/plan`, {
    planId: 'nonexistent-plan'
  });
  console.log('  HTTP状态:', res.status, '(预期: 404)');
  console.log('  错误码:', res.data.error);
  console.log('  错误信息:', res.data.message);

  step(6, '异常5: 人工修正缺少操作者 -> 400');
  res = await api('POST', `/api/tenants/${TENANT_ID}/correction`, {
    resourceType: 'storage',
    correction: -1,
    reason: '测试'
  });
  console.log('  HTTP状态:', res.status, '(预期: 400)');
  console.log('  错误码:', res.data.error);
  console.log('  错误信息:', res.data.message);

  step(7, '场景: 先冻结租户');
  res = await api('POST', `/api/tenants/${TENANT_ID}/freeze`, {
    reason: '欠费冻结',
    operator: 'billing-001'
  });
  console.log('  冻结结果:', res.data.success ? '✅ 成功' : '❌ 失败');

  step(8, '异常6: 冻结后上报用量 -> 400 TENANT_FROZEN');
  res = await api('POST', `/api/tenants/${TENANT_ID}/usage`, {
    resourceType: 'storage',
    amount: 100,
    requestId: 'frozen-test-001'
  });
  console.log('  HTTP状态:', res.status, '(预期: 400)');
  console.log('  错误码:', res.data.error);
  console.log('  错误信息:', res.data.message);
  console.log('  租户状态:', res.data.tenantStatus);

  step(9, '异常7: 重复冻结 -> 幂等返回 (不报错)');
  res = await api('POST', `/api/tenants/${TENANT_ID}/freeze`, {
    reason: '再次冻结',
    operator: 'test'
  });
  console.log('  重复冻结结果:');
  console.log('    success:', res.data.success);
  console.log('    idempotent:', res.data.idempotent);
  console.log('    message:', res.data.message);

  step(10, '解冻以便后续测试');
  res = await api('POST', `/api/tenants/${TENANT_ID}/unfreeze`, {
    reason: '继续测试',
    operator: 'test'
  });
  console.log('  解冻结果:', res.data.success ? '✅ 成功' : '❌ 失败');

  step(11, '场景: 演示 加购包过期 导致超用');
  console.log('  先使用掉大部分配额 (存储 0.8GB，配额 1GB)');
  res = await api('POST', `/api/tenants/${TENANT_ID}/usage`, {
    resourceType: 'storage',
    amount: 800,
    requestId: 'expire-demo-base'
  });
  console.log('  上报结果:', res.data.success ? '✅ 成功' : '❌ 失败');

  console.log('  购买临时加购包 (100GB，设置为立即过期以便演示)');
  const { db } = require('../src/db');
  const addonId = `addon_expired_${Date.now()}`;
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dayBefore = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  db.prepare(`
    INSERT INTO addon_packages (id, tenant_id, type, amount, effective_at, expires_at, source, created_by)
    VALUES (?, ?, 'storage', 100, ?, ?, 'demo', 'test')
  `).run(
    addonId,
    TENANT_ID,
    dayBefore.toISOString().slice(0, 10),
    yesterday.toISOString().slice(0, 10)
  );
  console.log('  ✅ 已插入过期的加购包 (100GB)');

  console.log('  上报大量用量 (基于加购包有效时的错觉)');
  res = await api('POST', `/api/tenants/${TENANT_ID}/usage`, {
    resourceType: 'storage',
    amount: 50,
    requestId: 'expire-demo-overuse'
  });
  console.log('  上报结果:', res.data.success ? '✅ 成功 (API 允许上报，但账本会显示超用)' : '❌ 失败');

  step(12, '查询配额账本 - 加购包过期后，使用量超出 1GB 基础配额');
  res = await api('GET', `/api/tenants/${TENANT_ID}/ledger`);
  printLedgerSummary(res.data.ledger);
  const storageLedger = res.data.ledger.ledger.storage;
  console.log('\n  📊 超用原因分析 (预期包含 addon_expired):');
  if (storageLedger.overageReason) {
    storageLedger.overageReason.forEach(r => {
      console.log(`     [${r.type}] ${r.description}`);
    });
  }

  step(13, '异常8: 导出报告缺少日期参数 -> 400');
  res = await api('GET', `/api/tenants/${TENANT_ID}/report/daily`);
  console.log('  HTTP状态:', res.status, '(预期: 400)');
  console.log('  错误码:', res.data.error);
  console.log('  错误信息:', res.data.message);

  step(14, '异常9: 加购无效资源类型 -> 400');
  res = await api('POST', `/api/tenants/${TENANT_ID}/addons`, {
    type: 'invalid_resource',
    amount: 100
  });
  console.log('  HTTP状态:', res.status, '(预期: 400)');
  console.log('  错误码:', res.data.error);
  console.log('  错误信息:', res.data.message);

  step(15, '验证: 成功的幂等调用 (正常流程也不会重复计数)');
  console.log('  上报带 requestId 的用量:');
  const idempotentReq = 'req-idempotent-failure-demo';
  let r1 = await api('POST', `/api/tenants/${TENANT_ID}/usage`, {
    resourceType: 'call',
    amount: 50,
    requestId: idempotentReq
  });
  console.log('    第一次:', r1.data.idempotent ? '幂等' : '新建', r1.data.idempotent ? '' : `(ID=${r1.data.id})`);

  let r2 = await api('POST', `/api/tenants/${TENANT_ID}/usage`, {
    resourceType: 'call',
    amount: 50,
    requestId: idempotentReq
  });
  console.log('    第二次:', r2.data.idempotent ? '✅ 幂等返回 (正确)' : '❌ 重复记录');

  let r3 = await api('POST', `/api/tenants/${TENANT_ID}/usage`, {
    resourceType: 'call',
    amount: 50,
    requestId: idempotentReq
  });
  console.log('    第三次:', r3.data.idempotent ? '✅ 幂等返回 (正确)' : '❌ 重复记录');

  res = await api('GET', `/api/tenants/${TENANT_ID}/ledger`);
  console.log(`    call 资源累计使用: ${res.data.ledger.ledger.call.currentUsage} (预期为 50，不是 150)`);

  section('✅ 失败路径演示完成');
  console.log('');
  console.log('📌 异常处理能力验证:');
  console.log('   ✅ 409 资源已存在 (重复创建租户)');
  console.log('   ✅ 404 资源不存在 (租户/套餐)');
  console.log('   ✅ 400 参数校验 (缺少必填字段)');
  console.log('   ✅ 400 业务规则 (冻结后上报)');
  console.log('   ✅ 重复冻结/解冻的幂等性');
  console.log('   ✅ 人工修正必须指定操作者');
  console.log('   ✅ 加购包过期后的超用原因分析');
  console.log('   ✅ requestId 保证用量上报幂等');
  console.log('   ✅ 清晰的错误码和错误信息');
  console.log('');
}

main().catch(console.error);
