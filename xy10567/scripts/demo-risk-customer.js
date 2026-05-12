require('./seed');

const store = require('../src/models/store');
const renewalService = require('../src/services/renewalWorkflow');
const reportService = require('../src/services/reports');

async function demoRiskCustomer() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 演示场景 2: 风险客户流程');
  console.log('='.repeat(60) + '\n');

  const customers = store.getCustomers();
  const riskCustomer = customers.find(c => c.name === '前途网络科技');
  
  if (!riskCustomer) {
    console.error('❌ 未找到样例客户，请先运行 npm run seed');
    return;
  }

  const operator = 'csm_wang';

  console.log('⚠️  客户背景:');
  console.log('   - 客户: 前途网络科技 (电商行业)');
  console.log('   - 健康分: 28分 (critical - 极危险)');
  console.log('   - 使用趋势: 产品使用量持续下降');
  console.log('   - 风险因素: 使用量持续下降、低活跃度');
  console.log('');

  console.log('📌 步骤 1: 创建续约流程');
  const createResult = await renewalService.createWorkflow(
    riskCustomer.id, 
    'req-risk-001', 
    operator
  );
  
  const workflowId = createResult.workflow.id;
  console.log('   ✅ 流程创建成功');
  console.log('   - 流程ID: ' + workflowId);
  console.log('');

  console.log('📌 步骤 2: 汇总数据');
  const aggregateResult = await renewalService.aggregateData(workflowId, operator);
  console.log('   ✅ 数据汇总完成');
  console.log('   - 健康分: ' + aggregateResult.workflow.data.healthScore.score + ' 分');
  console.log('   - 风险因素: ' + aggregateResult.workflow.data.healthScore.risks.join('、'));
  console.log('');

  console.log('📌 步骤 3: 健康检查（触发风险规则）');
  console.log('   ⏳ 检查健康分规则...');
  console.log('   - 规则: 健康分 < 30 分标记为 critical 风险');
  console.log('   - 当前健康分: 28 分');
  console.log('');

  const healthResult = await renewalService.checkHealth(workflowId, operator);
  console.log('   ❌ 健康检查发现风险');
  console.log('   - 流程状态: ' + healthResult.workflow.status);
  console.log('   - 风险标志: ' + healthResult.riskFlags.length + ' 个');
  
  healthResult.riskFlags.forEach((risk, idx) => {
    console.log('   ' + (idx + 1) + '. [' + risk.level.toUpperCase() + '] ' + risk.message);
    console.log('      建议: ' + risk.action);
  });
  console.log('');

  console.log('📌 步骤 4: 查看告警信息');
  const workflow = renewalService.getWorkflow(workflowId);
  console.log('   ✅ 告警信息已记录');
  workflow.alerts.forEach((alert, idx) => {
    console.log('   ' + (idx + 1) + '. [' + alert.severity.toUpperCase() + '] ' + alert.message);
  });
  console.log('');

  console.log('📌 步骤 5: 生成风险分析报告');
  const report = reportService.generateRenewalReport(workflowId);
  console.log('   ✅ 报告生成完成');
  console.log('');
  console.log('   📊 风险分析:');
  console.log('   - 有风险: ' + report.riskAnalysis.hasRisks);
  console.log('   - 可以标绿: ' + report.riskAnalysis.canMarkGreen);
  console.log('');
  
  report.riskAnalysis.reasons.forEach((reason, idx) => {
    console.log('   风险 ' + (idx + 1) + ':');
    console.log('      - 类型: ' + reason.type);
    console.log('      - 严重程度: ' + reason.severity);
    console.log('      - 描述: ' + reason.message);
    console.log('      - 建议行动: ' + reason.action);
  });
  console.log('');

  console.log('📌 步骤 6: 人工介入处理（人工修正）');
  console.log('   - 客户成功经理安排紧急会议');
  console.log('   - 了解客户流失原因');
  console.log('   - 制定挽回方案');
  console.log('');

  const correctionResult = await renewalService.manualCorrection(workflowId, {
    status: 'at_risk',
    notes: '已安排紧急客户会议，客户反馈竞品价格更低且功能更多。正在准备定制方案。',
    reason: '客户成功经理紧急介入'
  }, operator);
  
  console.log('   ✅ 人工修正已记录');
  console.log('   - 操作者: ' + operator);
  console.log('   - 记录内容: 已安排紧急客户会议...');
  console.log('');

  console.log('📌 步骤 7: 查看历史记录（审计追踪）');
  const history = store.getHistory('renewal', workflowId);
  console.log('   ✅ 历史记录数: ' + history.length);
  history.forEach((h, idx) => {
    console.log('   ' + (idx + 1) + '. [' + h.timestamp.substring(11, 19) + '] ' + 
      h.action + ' - ' + h.operator);
    if (h.reason) {
      console.log('      原因: ' + h.reason);
    }
    if (h.changes && Object.keys(h.changes).length > 0) {
      console.log('      变更: ' + JSON.stringify(h.changes));
    }
  });
  console.log('');

  console.log('📌 步骤 8: 生成客户沟通报告');
  const commReport = reportService.generateCustomerCommunicationReport(workflowId);
  console.log('   ✅ 沟通报告生成完成');
  console.log('');
  console.log('   💡 总结建议:');
  console.log('   ' + commReport.communication.closingSuggestion);
  console.log('');

  console.log('✅ 风险客户流程演示完成！');
  console.log('');
  console.log('💡 关键要点:');
  console.log('   1. 健康分 28 分 < 30 分阈值，自动标记为 critical 风险');
  console.log('   2. 流程状态变为 at_risk，触发告警');
  console.log('   3. 报告明确指出不可标绿，需要人工介入');
  console.log('   4. 人工修正留下完整记录（操作者、时间、变更内容）');
  console.log('   5. 沟通报告提供针对性的挽回建议');
  console.log('');
}

demoRiskCustomer().catch(console.error);
