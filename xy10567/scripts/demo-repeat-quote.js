require('./seed');

const store = require('../src/models/store');
const renewalService = require('../src/services/renewalWorkflow');
const reportService = require('../src/services/reports');

async function demoRepeatQuote() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 演示场景 4: 重复报价 & 幂等机制');
  console.log('='.repeat(60) + '\n');

  const customers = store.getCustomers();
  const healthyCustomer = customers.find(c => c.name === '创新科技有限公司');
  
  if (!healthyCustomer) {
    console.error('❌ 未找到样例客户，请先运行 npm run seed');
    return;
  }

  const operator = 'csm_zhao';
  const requestId = 'req-repeat-demo-001';

  console.log('🔄 演示内容:');
  console.log('   1. 幂等机制 - 重复请求不重复创建');
  console.log('   2. 报价版本管理 - 重复报价保留历史版本');
  console.log('   3. 工单阻塞场景 - 重大工单未结不能标绿');
  console.log('');

  console.log('📌 步骤 1: 第一次创建流程');
  const createResult1 = await renewalService.createWorkflow(
    healthyCustomer.id, 
    requestId, 
    operator
  );
  
  const workflowId = createResult1.workflow.id;
  console.log('   ✅ 第一次创建');
  console.log('   - 流程ID: ' + workflowId);
  console.log('   - 是否幂等返回: ' + createResult1.isIdempotent);
  console.log('');

  console.log('📌 步骤 2: 使用相同 requestId 重复创建（测试幂等）');
  console.log('   ⏳ 模拟网络重试，使用相同 requestId...');
  const createResult2 = await renewalService.createWorkflow(
    healthyCustomer.id, 
    requestId, 
    operator
  );
  
  console.log('   ✅ 第二次创建（幂等返回）');
  console.log('   - 是否幂等返回: ' + createResult2.isIdempotent);
  console.log('   - 流程ID相同: ' + (createResult2.workflow.id === workflowId));
  console.log('');
  console.log('   💡 要点: 重复请求返回已存在的流程，不会重复创建');
  console.log('');

  console.log('📌 步骤 3: 推进流程到报价阶段');
  await renewalService.aggregateData(workflowId, operator);
  await renewalService.checkHealth(workflowId, operator);
  await renewalService.checkTickets(workflowId, operator);
  console.log('   ✅ 数据汇总、健康检查、工单检查完成');
  console.log('');

  console.log('📌 步骤 4: 第一次准备报价（v1）');
  const quoteDataV1 = {
    productLines: [
      { productId: 'product-core', name: '核心平台', quantity: 1, price: 80000 }
    ],
    baseTotal: 80000,
    discountPercent: 0,
    discountAmount: 0,
    finalTotal: 80000,
    terms: { months: 12 }
  };
  
  const quoteResult1 = await renewalService.prepareQuote(workflowId, quoteDataV1, operator);
  const quoteIdV1 = quoteResult1.quote.id;
  
  console.log('   ✅ 报价 v1 已创建');
  console.log('   - 版本: v' + quoteResult1.quote.version);
  console.log('   - 金额: ¥' + quoteResult1.quote.finalTotal.toLocaleString());
  console.log('');

  console.log('📌 步骤 5: 第二次准备报价（v2 - 客户要求降价）');
  const quoteDataV2 = {
    productLines: [
      { productId: 'product-core', name: '核心平台', quantity: 1, price: 80000 }
    ],
    baseTotal: 80000,
    discountPercent: 10,
    discountAmount: 8000,
    finalTotal: 72000,
    terms: { months: 12 }
  };
  
  const quoteResult2 = await renewalService.prepareQuote(workflowId, quoteDataV2, operator);
  const quoteIdV2 = quoteResult2.quote.id;
  
  console.log('   ✅ 报价 v2 已创建（新版本）');
  console.log('   - 版本: v' + quoteResult2.quote.version);
  console.log('   - 折扣: ' + quoteDataV2.discountPercent + '%');
  console.log('   - 金额: ¥' + quoteResult2.quote.finalTotal.toLocaleString());
  console.log('');

  console.log('📌 步骤 6: 第三次准备报价（v3 - 增加产品）');
  const quoteDataV3 = {
    productLines: [
      { productId: 'product-core', name: '核心平台', quantity: 1, price: 80000 },
      { productId: 'product-analytics', name: '数据分析', quantity: 1, price: 40000 }
    ],
    baseTotal: 120000,
    discountPercent: 15,
    discountAmount: 18000,
    finalTotal: 102000,
    terms: { months: 12 }
  };
  
  const quoteResult3 = await renewalService.prepareQuote(workflowId, quoteDataV3, operator);
  
  console.log('   ✅ 报价 v3 已创建（新版本）');
  console.log('   - 版本: v' + quoteResult3.quote.version);
  console.log('   - 产品数: 2个');
  console.log('   - 折扣: ' + quoteDataV3.discountPercent + '%');
  console.log('   - 金额: ¥' + quoteResult3.quote.finalTotal.toLocaleString());
  console.log('');

  console.log('📌 步骤 7: 查看报价历史（版本管理）');
  const allQuotes = store.getQuotes(healthyCustomer.id)
    .filter(q => q.workflowId === workflowId)
    .sort((a, b) => a.version - b.version);
  
  console.log('   ✅ 报价历史:');
  allQuotes.forEach((q, idx) => {
    console.log('');
    console.log('   报价 v' + q.version + ':');
    console.log('      - 创建时间: ' + q.createdAt.substring(11, 19));
    console.log('      - 基础金额: ¥' + q.baseTotal.toLocaleString());
    console.log('      - 折扣: ' + q.discountPercent + '% (-¥' + q.discountAmount.toLocaleString() + ')');
    console.log('      - 最终金额: ¥' + q.finalTotal.toLocaleString());
    console.log('      - 状态: ' + q.status);
  });
  console.log('');

  console.log('📌 步骤 8: 查看报价变更历史记录');
  const quoteHistory = store.getHistory('quote', quoteIdV2);
  console.log('   ✅ 报价 v2 的历史记录:');
  quoteHistory.forEach((h, idx) => {
    console.log('   ' + (idx + 1) + '. ' + h.action + ' - ' + h.operator);
    if (h.changes && h.changes.from) {
      console.log('      变更: v' + h.changes.from.discountPercent + '% → v' + h.changes.to.discountPercent + '%');
    }
  });
  console.log('');

  console.log('📌 步骤 9: 演示工单阻塞场景（阳光制造集团）');
  const ticketBlockedCustomer = customers.find(c => c.name === '阳光制造集团');
  
  console.log('');
  console.log('   ⚠️  客户: 阳光制造集团');
  console.log('   - 健康分: 75分 (good)');
  console.log('   - 工单: 2个重大未结工单');
  console.log('');

  const createResult3 = await renewalService.createWorkflow(
    ticketBlockedCustomer.id, 
    'req-ticket-blocked-001', 
    operator
  );
  
  const blockedWorkflowId = createResult3.workflow.id;
  
  await renewalService.aggregateData(blockedWorkflowId, operator);
  await renewalService.checkHealth(blockedWorkflowId, operator);
  
  console.log('   📌 工单检查（触发阻塞规则）');
  console.log('   ⏳ 检查工单规则...');
  console.log('   - 规则: 重大未结工单不能标绿');
  console.log('   - 当前状态: 有 2 个重大未结工单 (1个已超SLA)');
  console.log('');

  const ticketCheckResult = await renewalService.checkTickets(blockedWorkflowId, operator);
  
  console.log('   ❌ 工单检查阻塞');
  console.log('   - 流程状态: ' + ticketCheckResult.workflow.status);
  console.log('   - 可以标绿: ' + ticketCheckResult.canProceed);
  console.log('');
  
  console.log('   阻塞工单详情:');
  ticketCheckResult.blockingTickets.forEach((ticket, idx) => {
    console.log('   ' + (idx + 1) + '. [' + ticket.priority.toUpperCase() + '] ' + ticket.title);
  });
  console.log('');

  console.log('📌 步骤 10: 生成报告验证');
  const report = reportService.generateRenewalReport(workflowId);
  console.log('   ✅ 创新科技续约报告:');
  console.log('   - 最新报价版本: v' + report.quotes.latestVersion);
  console.log('   - 报价历史数: ' + report.quotes.history.length);
  console.log('   - 可以标绿: ' + report.riskAnalysis.canMarkGreen);
  console.log('');

  const blockedReport = reportService.generateRenewalReport(blockedWorkflowId);
  console.log('   ✅ 阳光制造集团报告:');
  console.log('   - 可以标绿: ' + blockedReport.riskAnalysis.canMarkGreen);
  console.log('   - 风险数量: ' + blockedReport.riskAnalysis.reasons.length);
  console.log('');

  console.log('✅ 重复报价 & 幂等机制演示完成！');
  console.log('');
  console.log('💡 关键要点:');
  console.log('   1. 幂等机制: 使用 requestId 确保重复请求不重复创建');
  console.log('   2. 报价版本: 每次新建报价自动递增版本号 (v1 → v2 → v3)');
  console.log('   3. 历史记录: 所有报价变更都有完整审计记录');
  console.log('   4. 工单规则: 重大未结工单 → 流程状态变为 blocked，不可标绿');
  console.log('   5. 报告验证: 报告明确展示报价历史和风险状态');
  console.log('');
  console.log('   报价变更追踪:');
  console.log('   ┌─────────────────────────────────────────────────────┐');
  console.log('   │ v1: ¥80,000 (0% 折扣)  - 初始报价                    │');
  console.log('   │ v2: ¥72,000 (10% 折扣) - 客户要求降价               │');
  console.log('   │ v3: ¥102,000 (15% 折扣) - 增加产品包，扩大折扣      │');
  console.log('   └─────────────────────────────────────────────────────┘');
  console.log('');
}

demoRepeatQuote().catch(console.error);
