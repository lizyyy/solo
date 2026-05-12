require('./seed');

const store = require('../src/models/store');
const renewalService = require('../src/services/renewalWorkflow');
const reportService = require('../src/services/reports');
const { checkDiscountApprovalRule, RULE_CONFIG } = require('../src/services/rules');

async function demoDiscountApproval() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 演示场景 3: 折扣审批流程');
  console.log('='.repeat(60) + '\n');

  const customers = store.getCustomers();
  const discountCustomer = customers.find(c => c.name === '星辰教育科技');
  
  if (!discountCustomer) {
    console.error('❌ 未找到样例客户，请先运行 npm run seed');
    return;
  }

  const operator = 'csm_chen';
  const approver = 'manager_li';

  console.log('⚙️  规则配置:');
  console.log('   - Standard 客户标准折扣: ≤ ' + RULE_CONFIG.discounts.standardTierThreshold + '%');
  console.log('   - Premium 客户标准折扣: ≤ ' + RULE_CONFIG.discounts.premiumTierThreshold + '%');
  console.log('   - Enterprise 客户标准折扣: ≤ ' + RULE_CONFIG.discounts.enterpriseTierThreshold + '%');
  console.log('');
  console.log('📊 客户背景:');
  console.log('   - 客户: 星辰教育科技');
  console.log('   - 客户级别: standard (标准阈值 10%)');
  console.log('   - 健康分: 82 分 (good)');
  console.log('');

  console.log('📌 步骤 1: 测试折扣规则引擎');
  console.log('   - 测试 5% 折扣:');
  const result1 = checkDiscountApprovalRule(5, 'standard');
  console.log('     结果: ' + result1.reason);
  console.log('     需要审批: ' + result1.approvalRequired);
  
  console.log('');
  console.log('   - 测试 15% 折扣 (超标准阈值):');
  const result2 = checkDiscountApprovalRule(15, 'standard');
  console.log('     结果: ' + result2.reason);
  console.log('     需要审批: ' + result2.approvalRequired);
  console.log('     审批级别: ' + (result2.requiredApproval ? result2.requiredApproval.approver : '无需'));
  console.log('');

  console.log('📌 步骤 2: 创建续约流程');
  const createResult = await renewalService.createWorkflow(
    discountCustomer.id, 
    'req-discount-001', 
    operator
  );
  
  const workflowId = createResult.workflow.id;
  console.log('   ✅ 流程创建成功');
  console.log('');

  console.log('📌 步骤 3: 汇总数据并通过检查');
  await renewalService.aggregateData(workflowId, operator);
  await renewalService.checkHealth(workflowId, operator);
  await renewalService.checkTickets(workflowId, operator);
  console.log('   ✅ 健康检查、工单检查通过');
  console.log('');

  console.log('📌 步骤 4: 准备报价（申请 15% 折扣）');
  const quoteData = {
    productLines: [
      { productId: 'product-core', name: '核心平台', quantity: 1, price: 45000 },
      { productId: 'product-support', name: '企业支持', quantity: 1, price: 15000 }
    ],
    baseTotal: 60000,
    discountPercent: 15,
    discountAmount: 9000,
    finalTotal: 51000,
    terms: { months: 12, startDate: '2025-08-01' }
  };
  
  const quoteResult = await renewalService.prepareQuote(workflowId, quoteData, operator);
  const quoteId = quoteResult.quote.id;
  
  console.log('   ✅ 报价准备完成');
  console.log('   - 报价版本: v' + quoteResult.quote.version);
  console.log('   - 基础金额: ¥' + quoteData.baseTotal.toLocaleString());
  console.log('   - 申请折扣: ' + quoteData.discountPercent + '%');
  console.log('   - 折扣金额: ¥' + quoteData.discountAmount.toLocaleString());
  console.log('   - 最终金额: ¥' + quoteData.finalTotal.toLocaleString());
  console.log('');
  console.log('   ⚠️  折扣检查:');
  console.log('   - 需要审批: ' + quoteResult.approvalRequired);
  console.log('   - 审批级别: ' + (quoteResult.approvalInfo ? quoteResult.approvalInfo.approver : '无需'));
  console.log('   - 原因: 折扣 15% 超出 standard 客户标准阈值 (10%)');
  console.log('');

  console.log('📌 步骤 5: 经理审批折扣');
  const approvalResult = await renewalService.approveDiscount(workflowId, quoteId, {
    approved: true,
    level: 'level2',
    comments: '客户是教育行业重点客户，符合战略扶持政策，同意 15% 折扣'
  }, approver);
  
  console.log('   ✅ 折扣审批通过');
  console.log('   - 审批人: ' + approver);
  console.log('   - 审批级别: level2 (manager)');
  console.log('   - 审批意见: 客户是教育行业重点客户...');
  console.log('   - 流程状态: ' + approvalResult.workflow.status);
  console.log('');

  console.log('📌 步骤 6: 查看报价历史（版本管理）');
  const quotes = store.getQuotes(discountCustomer.id)
    .filter(q => q.workflowId === workflowId);
  
  console.log('   ✅ 报价历史:');
  quotes.forEach((q, idx) => {
    console.log('   - v' + q.version + ': ¥' + q.finalTotal.toLocaleString() + 
      ' (' + q.discountPercent + '% 折扣) - 状态: ' + q.status);
  });
  console.log('');

  console.log('📌 步骤 7: 查看历史记录');
  const history = store.getHistory('renewal', workflowId);
  console.log('   ✅ 历史记录数: ' + history.length);
  history.forEach((h, idx) => {
    console.log('   ' + (idx + 1) + '. [' + h.timestamp.substring(11, 19) + '] ' + 
      h.action + ' - ' + h.operator);
    if (h.reason) {
      console.log('      ' + h.reason);
    }
  });
  console.log('');

  console.log('📌 步骤 8: 生成续约报告');
  const report = reportService.generateRenewalReport(workflowId);
  console.log('   ✅ 报告生成完成');
  console.log('');
  console.log('   📊 报价历史:');
  report.quotes.history.forEach((q, idx) => {
    console.log('   ' + (idx + 1) + '. v' + q.version + ': ¥' + q.finalTotal.toLocaleString() + 
      ' (' + q.discountPercent + '% 折扣) - ' + q.status);
  });
  console.log('');

  console.log('✅ 折扣审批流程演示完成！');
  console.log('');
  console.log('💡 关键要点:');
  console.log('   1. Standard 客户标准折扣阈值: 10%');
  console.log('   2. 15% 折扣超出阈值，需要 manager 级别审批');
  console.log('   3. 审批流记录完整的审批人、审批级别、审批意见');
  console.log('   4. 报价历史保留所有版本（v1, v2...）');
  console.log('   5. 可追溯谁在什么时间因为什么原因审批通过');
  console.log('');
}

demoDiscountApproval().catch(console.error);
