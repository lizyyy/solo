const sealService = require('../src/services/sealApplicationService');
const contractService = require('../src/services/contractService');
const database = require('../src/database');
const { formatAmount } = require('../src/utils');

function printSeparator(title = '') {
  const line = '='.repeat(80);
  console.log('\n' + line);
  if (title) {
    console.log(title);
    console.log(line);
  }
}

function printStep(step, message) {
  console.log(`\n【步骤 ${step}】${message}`);
  console.log('-'.repeat(60));
}

async function demoSealTypeMismatch() {
  printSeparator('失败场景一：印章类型不匹配 (普通合同用了财务专用章)');

  printStep(1, '创建用章申请 (误用财务专用章)');
  const result = sealService.createApplication({
    contract: {
      name: '服务合同',
      category: 'SERVICE',
      amount: 300000,
      partyA: '甲方-公司',
      partyB: '乙方-服务商',
    },
    sealType: 'FINANCIAL_SEAL',
    applicant: '业务-小钱',
    department: '业务部',
    reason: '业务合作用章',
  });

  const appId = result.application.id;
  console.log('创建成功！');
  console.log('  合同类型:', result.contract.category);
  console.log('  申请印章:', result.application.seal_type);

  printStep(2, '查看创建时的风险扫描结果');
  console.log('风险扫描结果:');
  console.log('  全部通过:', result.riskScan.allPassed);
  
  if (result.riskScan.highRisks.length > 0) {
    console.log('  检测到高风险:');
    result.riskScan.highRisks.forEach(r => {
      console.log(`    - ${r.ruleName}: ${r.riskReason}`);
      console.log(`      建议: ${r.suggestion}`);
    });
  }

  console.log('\n❌ 场景一说明：印章类型不匹配被检测为高风险\n');
  return appId;
}

async function demoWrongApprover() {
  printSeparator('失败场景二：错误的审批人审批');

  printStep(1, '创建并提交用章申请');
  const createResult = sealService.createApplication({
    contract: {
      name: '普通服务合同',
      category: 'SERVICE',
      amount: 100000,
      partyA: '甲方-公司',
      partyB: '乙方-服务商',
    },
    sealType: 'CONTRACT_SEAL',
    applicant: '业务-小孙',
    department: '业务部',
    reason: '业务合作',
  });

  const appId = createResult.application.id;
  sealService.submitApplication(appId, '业务-小孙');

  printStep(2, '查看审批链');
  const chain = createResult.approvalChain;
  console.log('审批链:');
  chain.forEach((step, i) => {
    console.log(`  ${i + 1}. ${step.approver} (顺序: ${step.step_order})`);
  });

  printStep(3, '尝试用错误的审批人审批');
  try {
    sealService.approveStep(appId, '错误的审批人-张三', '我来审批');
    console.log('审批成功 (不应该发生)');
  } catch (err) {
    console.log('审批失败 (预期):', err.message);
  }

  printStep(4, '查看申请详情，状态仍为待审批');
  const detail = sealService.getApplicationDetail(appId);
  console.log('当前状态:', detail.application.status);
  console.log('审批记录数:', detail.statusHistory ? detail.statusHistory.length : 0);

  console.log('\n❌ 场景二说明：只有审批链上指定的人才能审批\n');
  return appId;
}

async function demoSealBeforeApprovalComplete() {
  printSeparator('失败场景三：未完成审批就尝试用章');

  printStep(1, '创建用章申请');
  const createResult = sealService.createApplication({
    contract: {
      name: '技术开发合同',
      category: 'SERVICE',
      amount: 500000,
      partyA: '甲方-公司',
      partyB: '乙方-开发商',
    },
    sealType: 'CONTRACT_SEAL',
    applicant: '研发-小周',
    department: '研发部',
    reason: '项目开发',
  });

  const appId = createResult.application.id;
  sealService.submitApplication(appId, '研发-小周');

  printStep(2, '只完成部门经理审批，跳过财务经理');
  sealService.approveStep(appId, '部门经理-张三', '同意');

  printStep(3, '查看当前审批进度');
  const detail1 = sealService.getApplicationDetail(appId);
  console.log('当前状态:', detail1.application.status);
  console.log('审批链完成情况:');
  detail1.approvalChain.forEach(step => {
    console.log(`  ${step.approver}: ${step.status}`);
  });

  printStep(4, '尝试提前用章');
  try {
    sealService.confirmSeal(appId, '印章管理员-赵六', 2);
    console.log('用章成功 (不应该发生)');
  } catch (err) {
    console.log('用章失败 (预期):', err.message);
  }

  printStep(5, '完成剩余审批后才能用章');
  sealService.approveStep(appId, '财务经理-李四', '财务审核通过');
  
  const detail2 = sealService.getApplicationDetail(appId);
  console.log('完成所有审批后的状态:', detail2.application.status);

  const sealResult = sealService.confirmSeal(appId, '印章管理员-赵六', 2);
  console.log('用章成功，最终状态:', sealResult.application.status);

  console.log('\n❌ 场景三说明：必须走完所有审批才能用章\n');
  return appId;
}

async function demoWithdrawAfterApprovalComplete() {
  printSeparator('失败场景四：审批完成后尝试撤回');

  printStep(1, '创建并完成所有审批');
  const createResult = sealService.createApplication({
    contract: {
      name: '供应商合作合同',
      category: 'PURCHASE',
      amount: 200000,
      partyA: '甲方-公司',
      partyB: '乙方-供应商',
    },
    sealType: 'CONTRACT_SEAL',
    applicant: '采购-小吴',
    department: '采购部',
    reason: '物料采购',
  });

  const appId = createResult.application.id;
  sealService.submitApplication(appId, '采购-小吴');
  sealService.approveStep(appId, '部门经理-张三', '同意');
  sealService.approveStep(appId, '财务经理-李四', '同意');

  printStep(2, '查看当前状态');
  const detail1 = sealService.getApplicationDetail(appId);
  console.log('审批完成后状态:', detail1.application.status);

  printStep(3, '尝试撤回已审批完成的申请');
  try {
    sealService.withdrawApplication(appId, '采购-小吴', '想撤回');
    console.log('撤回成功 (不应该发生)');
  } catch (err) {
    console.log('撤回失败 (预期):', err.message);
  }

  printStep(4, '用章确认后更无法撤回');
  sealService.confirmSeal(appId, '印章管理员-赵六', 1);
  
  const detail2 = sealService.getApplicationDetail(appId);
  console.log('用章后状态:', detail2.application.status);

  try {
    sealService.withdrawApplication(appId, '采购-小吴', '还是想撤回');
    console.log('撤回成功 (不应该发生)');
  } catch (err) {
    console.log('撤回失败 (预期):', err.message);
  }

  console.log('\n❌ 场景四说明：审批完成或用章后无法撤回\n');
  return appId;
}

async function runFailureDemos() {
  await database.initDb();
  
  printSeparator('开始演示失败场景', '');

  await demoSealTypeMismatch();
  await demoWrongApprover();
  await demoSealBeforeApprovalComplete();
  await demoWithdrawAfterApprovalComplete();

  printSeparator('所有失败场景演示完成！');
  
  console.log('\n📋 失败场景总结:');
  console.log('  1. 印章类型不匹配 → 风险扫描标记为高风险');
  console.log('  2. 错误审批人审批 → 系统拒绝，状态不变');
  console.log('  3. 未完成审批用章 → 系统拒绝，必须走完所有审批');
  console.log('  4. 审批完成后撤回 → 系统拒绝，已完成的流程不可撤销');
  
  console.log('\n💡 所有失败场景都有明确的错误提示和失败原因记录');
  console.log('💡 可通过 /api/seal-applications/:id/history 查看完整的操作历史\n');
}

if (require.main === module) {
  runFailureDemos().catch(console.error);
}

module.exports = {
  demoSealTypeMismatch,
  demoWrongApprover,
  demoSealBeforeApprovalComplete,
  demoWithdrawAfterApprovalComplete,
  runFailureDemos,
};
