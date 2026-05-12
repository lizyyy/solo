const sealService = require('../src/services/sealApplicationService');
const contractService = require('../src/services/contractService');
const reportService = require('../src/services/reportService');
const config = require('../src/config');
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

function printResult(obj, indent = 0) {
  const prefix = ' '.repeat(indent);
  for (const [key, value] of Object.entries(obj || {})) {
    if (typeof value === 'object' && value !== null) {
      console.log(`${prefix}${key}:`);
      printResult(value, indent + 2);
    } else {
      console.log(`${prefix}${key}: ${value}`);
    }
  }
}

async function demoNormalContract() {
  printSeparator('场景一：普通合同通过流程 (金额低于阈值)');

  printStep(1, '创建用章申请');
  const createResult = sealService.createApplication({
    contract: {
      name: '软件开发服务合同',
      category: 'SERVICE',
      amount: 500000,
      partyA: '甲方-科技有限公司',
      partyB: '乙方-信息技术有限公司',
    },
    sealType: 'CONTRACT_SEAL',
    applicant: '申请人-小王',
    department: '研发部',
    reason: '项目合作用章',
  });

  const appId = createResult.application.id;
  console.log('创建成功！');
  console.log('  申请ID:', appId);
  console.log('  合同金额:', formatAmount(createResult.contract.amount));
  console.log('  审批链人数:', createResult.approvalChain.length);
  console.log('  风险扫描通过:', createResult.riskScan.allPassed);

  printStep(2, '提交审批');
  const submitResult = sealService.submitApplication(appId, '申请人-小王');
  console.log('提交成功，当前状态:', submitResult.application.status);

  printStep(3, '部门经理审批通过');
  const approve1 = sealService.approveStep(appId, '部门经理-张三', '同意');
  console.log('部门经理审批通过，当前状态:', approve1.application.status);

  printStep(4, '财务经理审批通过');
  const approve2 = sealService.approveStep(appId, '财务经理-李四', '财务审核通过');
  console.log('财务经理审批通过，当前状态:', approve2.application.status);

  printStep(5, '用章确认');
  const sealResult = sealService.confirmSeal(appId, '印章管理员-赵六', 2, '正式盖章2份');
  console.log('用章确认成功！');
  console.log('  最终状态:', sealResult.application.status);
  console.log('  盖章数量:', sealResult.confirmation.seal_count);

  printStep(6, '生成报告查看最终状态');
  const report = reportService.generateApplicationReport(appId);
  console.log('报告摘要:');
  console.log('  合同名称:', report.contractInfo.name);
  console.log('  合同金额:', report.contractInfo.amount);
  console.log('  最终状态:', report.sealStatus.finalStatus.status);
  console.log('  状态说明:', report.sealStatus.finalStatus.reason);
  console.log('  审批时间线:');
  report.timeline.forEach((t, i) => {
    console.log(`    ${i + 1}. [${t.time}] ${t.operator} - ${t.action}`);
    if (t.comment) console.log(`       ${t.comment}`);
  });

  console.log('\n✅ 场景一完成：普通合同已成功闭环\n');
  return appId;
}

async function demoHighAmountApproval() {
  printSeparator('场景二：高金额合同加签流程 (金额超过阈值 ¥1,000,000)');

  printStep(1, '创建高金额合同用章申请');
  const createResult = sealService.createApplication({
    contract: {
      name: '大型设备采购合同',
      category: 'PURCHASE',
      amount: 2500000,
      partyA: '甲方-集团总部',
      partyB: '乙方-设备供应商有限公司',
    },
    sealType: 'COMPANY_SEAL',
    applicant: '采购部-小李',
    department: '采购部',
    reason: '年度采购计划',
  });

  const appId = createResult.application.id;
  console.log('创建成功！');
  console.log('  申请ID:', appId);
  console.log('  合同金额:', formatAmount(createResult.contract.amount));
  console.log('  审批链人数:', createResult.approvalChain.length, '(超过阈值，自动加签总经理)');
  console.log('  审批人:', createResult.approvalChain.map(a => a.approver).join(' → '));

  printStep(2, '查看风险扫描结果');
  const risks = createResult.riskScan;
  console.log('风险扫描结果:');
  console.log('  全部通过:', risks.allPassed);
  if (risks.mediumRisks.length > 0) {
    console.log('  检测到中风险:');
    risks.mediumRisks.forEach(r => {
      console.log(`    - ${r.ruleName}: ${r.riskReason}`);
      console.log(`      建议: ${r.suggestion}`);
    });
  }

  printStep(3, '提交审批');
  sealService.submitApplication(appId, '采购部-小李');

  printStep(4, '部门经理审批');
  sealService.approveStep(appId, '部门经理-张三', '采购需求合理');

  printStep(5, '财务经理审批');
  sealService.approveStep(appId, '财务经理-李四', '预算内，可以执行');

  printStep(6, '总经理审批 (加签)');
  const gmApprove = sealService.approveStep(appId, '总经理-王五', '同意采购，注意验收');
  console.log('总经理审批通过，当前状态:', gmApprove.application.status);

  printStep(7, '用章确认');
  const sealResult = sealService.confirmSeal(appId, '印章管理员-赵六', 4);
  console.log('最终状态:', sealResult.application.status);

  console.log('\n✅ 场景二完成：高金额合同已成功闭环，自动触发总经理加签\n');
  return appId;
}

async function demoWithdrawAndResubmitWithSubjectChange() {
  printSeparator('场景三：撤回后主体变更再重提流程');

  printStep(1, '创建初始用章申请');
  const createResult = sealService.createApplication({
    contract: {
      name: '技术合作框架协议',
      category: 'COOPERATION',
      amount: 800000,
      partyA: '甲方-原合作公司',
      partyB: '乙方-我方公司',
    },
    sealType: 'COMPANY_SEAL',
    applicant: '商务-小陈',
    department: '商务部',
    reason: '战略合作',
  });

  const originalAppId = createResult.application.id;
  console.log('创建成功！');
  console.log('  初始申请ID:', originalAppId);
  console.log('  初始甲方:', createResult.contract.party_a);

  printStep(2, '提交审批');
  sealService.submitApplication(originalAppId, '商务-小陈');

  printStep(3, '部门经理审批通过');
  sealService.approveStep(originalAppId, '部门经理-张三', '同意');

  printStep(4, '申请人撤回 (发现甲方名称有误)');
  const withdrawResult = sealService.withdrawApplication(
    originalAppId, 
    '商务-小陈', 
    '甲方公司名称有误，需要修改后重新提交'
  );
  console.log('撤回成功！');
  console.log('  撤回原因:', withdrawResult.application.withdraw_reason);
  console.log('  当前状态:', withdrawResult.application.status);

  printStep(5, '修改合同主体后重提申请');
  const resubmitResult = sealService.resubmitApplication(originalAppId, {
    contract: {
      name: '技术合作框架协议',
      category: 'COOPERATION',
      amount: 800000,
      partyA: '甲方-更正后的合作公司',
      partyB: '乙方-我方公司',
    },
    applicant: '商务-小陈',
    department: '商务部',
    reason: '战略合作 (已修正甲方名称)',
  });

  const newAppId = resubmitResult.application.id;
  console.log('重提成功！');
  console.log('  新申请ID:', newAppId);
  console.log('  来源申请ID:', resubmitResult.application.original_application_id);
  console.log('  重提次数:', resubmitResult.application.resubmit_count);
  console.log('  修正后甲方:', resubmitResult.contract.party_a);

  printStep(6, '查看字段变更记录');
  const fieldChanges = sealService.getFieldChangeHistory(newAppId);
  console.log('检测到的字段变更:');
  fieldChanges.forEach(c => {
    console.log(`  - ${c.field_name}: ${c.old_value} → ${c.new_value}`);
    console.log(`    操作人: ${c.operator}, 时间: ${c.created_at}`);
  });

  printStep(7, '查看风险扫描结果 (主体变更检测)');
  const risks = resubmitResult.riskScan;
  console.log('风险扫描结果:');
  console.log('  全部通过:', risks.allPassed);
  
  if (risks.criticalRisks.length > 0) {
    console.log('  检测到严重风险(主体变更):');
    risks.criticalRisks.forEach(r => {
      console.log(`    - ${r.ruleName}: ${r.riskReason}`);
      console.log(`      建议: ${r.suggestion}`);
    });
  }
  
  if (risks.mediumRisks.length > 0) {
    console.log('  检测到中风险(撤回历史):');
    risks.mediumRisks.forEach(r => {
      console.log(`    - ${r.ruleName}: ${r.riskReason}`);
    });
  }

  printStep(8, '重新走完整审批流程 (主体变更后旧审批失效)');
  sealService.submitApplication(newAppId, '商务-小陈');
  sealService.approveStep(newAppId, '部门经理-张三', '已确认甲方名称修正正确');
  sealService.approveStep(newAppId, '财务经理-李四', '财务审核通过');

  printStep(9, '用章确认');
  const sealResult = sealService.confirmSeal(newAppId, '印章管理员-赵六', 2);
  console.log('最终状态:', sealResult.application.status);

  printStep(10, '生成完整报告');
  const report = reportService.generateApplicationReport(newAppId);
  console.log('报告摘要:');
  console.log('  是否重提:', report.basicInfo.isResubmit);
  console.log('  重提次数:', report.basicInfo.resubmitCount);
  console.log('  字段变更数:', report.fieldChanges.totalChanges);
  console.log('  相关申请数:', report.relatedApplications.length);
  console.log('  相关申请ID:', report.relatedApplications.map(a => `${a.id}(${a.status})`).join(', '));
  console.log('  最终状态:', report.sealStatus.finalStatus.status);

  console.log('\n✅ 场景三完成：撤回修改主体后重提，系统检测到主体变更，历史审批失效，必须重新走完整流程\n');
  return newAppId;
}

async function demoDuplicateSubmit() {
  printSeparator('场景四：重复提交幂等性测试');

  printStep(1, '创建合同');
  const contract = contractService.createContract({
    name: '办公耗材采购合同',
    category: 'PURCHASE',
    amount: 50000,
    partyA: '甲方-行政部',
    partyB: '乙方-供应商',
  });

  printStep(2, '第一次创建用章申请 (使用幂等键)');
  const idempotencyKey = 'IDEM-OFFICE-2024-001';
  const result1 = sealService.createApplication({
    idempotencyKey,
    contractId: contract.id,
    sealType: 'CONTRACT_SEAL',
    applicant: '行政-小张',
    department: '行政部',
    reason: '办公采购',
  });

  const appId1 = result1.application.id;
  console.log('第一次创建成功，申请ID:', appId1);

  printStep(3, '提交第一个申请，进入审批流程');
  sealService.submitApplication(appId1, '行政-小张');
  console.log('第一个申请已提交，状态变为 PENDING');

  printStep(4, '尝试为同一个合同创建第二个用章申请 (模拟重复申请)');
  const result2 = sealService.createApplication({
    contractId: contract.id,
    sealType: 'CONTRACT_SEAL',
    applicant: '行政-小张',
    department: '行政部',
    reason: '办公采购',
  });
  
  const appId2 = result2.application.id;
  console.log('第二次创建成功，申请ID:', appId2);
  console.log('两个申请ID不同:', appId1 !== appId2 ? '是' : '否');

  printStep(5, '查看第二次创建时的风险扫描 (应检测到重复申请)');
  console.log('风险扫描结果:');
  console.log('  全部通过:', result2.riskScan.allPassed);
  
  if (result2.riskScan.highRisks.length > 0) {
    console.log('  检测到高风险:');
    result2.riskScan.highRisks.forEach(r => {
      console.log(`    - ${r.ruleName}: ${r.riskReason}`);
      console.log(`      建议: ${r.suggestion}`);
    });
  }

  console.log('\n✅ 场景四完成：重复申请检测正常，风险引擎会标记重复用章风险\n');
  return appId1;
}

async function runAllDemos() {
  await database.initDb();
  
  printSeparator('开始演示所有业务场景', '');
  
  const results = {};
  
  results.normal = await demoNormalContract();
  results.highAmount = await demoHighAmountApproval();
  results.withdraw = await demoWithdrawAndResubmitWithSubjectChange();
  results.duplicate = await demoDuplicateSubmit();

  printSeparator('所有演示完成！');
  console.log('\n生成的申请ID:');
  console.log('  普通合同:', results.normal);
  console.log('  高金额加签:', results.highAmount);
  console.log('  撤回重提:', results.withdraw);
  console.log('  重复申请:', results.duplicate);
  
  console.log('\n📊 可以通过以下接口查看详细报告:');
  console.log('  GET /api/seal-applications/:id/report      - JSON格式报告');
  console.log('  GET /api/seal-applications/:id/report/text - 文本格式报告');
  console.log('  GET /api/seal-applications/:id/timeline    - 审批时间线');
  console.log('  GET /api/seal-applications/:id/risks       - 风险扫描记录');
  console.log('\n');

  return results;
}

if (require.main === module) {
  runAllDemos().catch(console.error);
}

module.exports = {
  demoNormalContract,
  demoHighAmountApproval,
  demoWithdrawAndResubmitWithSubjectChange,
  demoDuplicateSubmit,
  runAllDemos,
};
