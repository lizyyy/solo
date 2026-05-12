require('./seed');

const store = require('../src/models/store');
const renewalService = require('../src/services/renewalWorkflow');
const reportService = require('../src/services/reports');
const { WORKFLOW_STATUS } = require('../src/models/factory');

async function demoHealthyRenewal() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 演示场景 1: 健康续约流程');
  console.log('='.repeat(60) + '\n');

  const customers = store.getCustomers();
  const healthyCustomer = customers.find(c => c.name === '创新科技有限公司');
  
  if (!healthyCustomer) {
    console.error('❌ 未找到样例客户，请先运行 npm run seed');
    return;
  }

  const operator = 'csm_zhang';

  console.log('📌 步骤 1: 创建续约流程');
  console.log('   - 客户: 创新科技有限公司');
  console.log('   - 操作者: ' + operator);
  
  const createResult = await renewalService.createWorkflow(
    healthyCustomer.id, 
    'req-healthy-001', 
    operator
  );
  
  const workflowId = createResult.workflow.id;
  console.log('   ✅ 流程创建成功');
  console.log('   - 流程ID: ' + workflowId);
  console.log('   - 状态: ' + createResult.workflow.status);
  console.log('');

  console.log('📌 步骤 2: 汇总数据（客户档案、使用量、健康分、工单）');
  const aggregateResult = await renewalService.aggregateData(workflowId, operator);
  console.log('   ✅ 数据汇总完成');
  console.log('   - 健康分: ' + aggregateResult.workflow.data.healthScore.score + ' 分');
  console.log('   - 使用产品数: ' + aggregateResult.workflow.data.usageMetrics.length);
  console.log('   - 未结工单: ' + aggregateResult.workflow.data.openTickets.length);
  console.log('   - 状态: ' + aggregateResult.workflow.status);
  console.log('');

  console.log('📌 步骤 3: 健康检查');
  const healthResult = await renewalService.checkHealth(workflowId, operator);
  console.log('   ✅ 健康检查通过');
  console.log('   - 健康分: 92分 (excellent)');
  console.log('   - 风险标志: ' + healthResult.workflow.riskFlags.length + ' 个');
  console.log('   - 状态: ' + healthResult.workflow.status);
  console.log('');

  console.log('📌 步骤 4: 工单检查');
  const ticketResult = await renewalService.checkTickets(workflowId, operator);
  console.log('   ✅ 工单检查通过');
  console.log('   - 无重大未结工单');
  console.log('   - 可以标绿: ' + ticketResult.canProceed);
  console.log('   - 状态: ' + ticketResult.workflow.status);
  console.log('');

  console.log('📌 步骤 5: 准备报价');
  const quoteData = {
    productLines: [
      { productId: 'product-core', name: '核心平台', quantity: 1, price: 80000 },
      { productId: 'product-analytics', name: '数据分析', quantity: 1, price: 40000 },
      { productId: 'product-support', name: '企业支持', quantity: 1, price: 30000 }
    ],
    baseTotal: 150000,
    discountPercent: 5,
    discountAmount: 7500,
    finalTotal: 142500,
    terms: { months: 12, startDate: '2025-06-01' }
  };
  
  const quoteResult = await renewalService.prepareQuote(workflowId, quoteData, operator);
  console.log('   ✅ 报价准备完成');
  console.log('   - 报价版本: v' + quoteResult.quote.version);
  console.log('   - 基础金额: ¥' + quoteData.baseTotal.toLocaleString());
  console.log('   - 折扣: ' + quoteData.discountPercent + '% (-¥' + quoteData.discountAmount.toLocaleString() + ')');
  console.log('   - 最终金额: ¥' + quoteData.finalTotal.toLocaleString());
  console.log('   - 需要审批: ' + (quoteResult.approvalRequired ? '是' : '否'));
  console.log('   - 状态: ' + quoteResult.workflow.status);
  console.log('');

  console.log('📌 步骤 6: 就绪等待客户成功经理跟进');
  const readyResult = await renewalService.markReadyForCSM(workflowId, operator);
  console.log('   ✅ 流程就绪');
  console.log('   - 状态: ' + readyResult.workflow.status);
  console.log('');

  console.log('📌 步骤 7: 客户接受报价');
  const acceptResult = await renewalService.customerAccept(workflowId, operator, {
    reason: '客户确认接受报价，预计下周完成签约'
  });
  console.log('   ✅ 客户已接受');
  console.log('   - 状态: ' + acceptResult.workflow.status);
  console.log('');

  console.log('📌 步骤 8: 完成续约流程');
  const completeResult = await renewalService.complete(workflowId, operator, '续约成功，客户对产品价值非常认可');
  console.log('   ✅ 续约流程完成');
  console.log('   - 最终状态: ' + completeResult.workflow.status);
  console.log('   - 完成时间: ' + completeResult.workflow.completedAt);
  console.log('');

  console.log('📌 步骤 9: 生成续约报告');
  const report = reportService.generateRenewalReport(workflowId);
  console.log('   ✅ 报告生成完成');
  console.log('   - 报告类型: ' + report.reportType);
  console.log('   - 客户: ' + report.customer.name);
  console.log('   - 健康分: ' + report.healthAssessment.score);
  console.log('   - 报价版本: v' + report.quotes.latestVersion);
  console.log('   - 风险数量: ' + report.riskAnalysis.reasons.length);
  console.log('   - 可以标绿: ' + report.riskAnalysis.canMarkGreen);
  console.log('');

  console.log('📌 步骤 10: 查看历史记录（审计追踪）');
  const history = store.getHistory('renewal', workflowId);
  console.log('   ✅ 历史记录数: ' + history.length);
  history.forEach((h, idx) => {
    console.log('   ' + (idx + 1) + '. [' + h.timestamp.substring(11, 19) + '] ' + 
      h.action + ' - ' + (h.reason || h.operator));
  });
  console.log('');

  console.log('✅ 健康续约流程演示完成！');
  console.log('');
  console.log('💡 关键要点:');
  console.log('   1. 健康分 92 分，所有规则检查通过');
  console.log('   2. 无重大未结工单，可以标绿推进');
  console.log('   3. 折扣 5% 在 Enterprise 客户阈值内，无需审批');
  console.log('   4. 每一步都有完整历史记录');
  console.log('   5. 报告可导出为 JSON 或 CSV');
  console.log('');
}

demoHealthyRenewal().catch(console.error);
