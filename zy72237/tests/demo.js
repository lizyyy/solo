const MarketValuationAnomalyAlert = require('../src/index');

async function runDemo() {
  console.log('========== 市值法估值异常提醒系统 - 完整演示 ==========\n');

  const system = new MarketValuationAnomalyAlert();

  console.log('【场景1】金额为 0 但备注写着已冲正 — 完整三步流程');
  console.log('========================================================');

  console.log('\n--- Step 1: 客户经理导入补充邮件 (含已冲正标记) ---');
  const emailResult = await system.importEmail({
    securityCode: '000001.SZ',
    securityName: '平安银行',
    marketValue: 0,
    calculatedValue: 1500000,
    deviation: 1500000,
    deviationRate: 1.0,
    remark: '该笔交易已冲正',
    emailId: 'EMAIL-2024-001',
    status: 'pending'
  }, '客户经理-张三');
  console.log('结果:', emailResult.message);
  console.log('isZeroWithReversal:', emailResult.anomaly.isZeroWithReversal);
  console.log('workflowStep:', emailResult.anomaly.workflowStep);
  console.log('status:', emailResult.anomaly.statusText);
  console.log('nextStep:', emailResult.nextStep);
  const anomalyId = emailResult.anomaly.id;

  console.log('\n--- Step 2: 支付平台产品阿南补看清算批次号 ---');
  const batchResult = await system.importBatch(anomalyId, {
    batchNo: 'BATCH-2024-0601-008',
    marketValue: 1500000,
    status: 'normal',
    operator: '阿南'
  }, '支付平台产品-阿南');
  console.log('结果:', batchResult.message);
  console.log('workflowStep:', batchResult.anomaly.workflowStep);
  if (batchResult.hasConflicts) {
    console.log('冲突列表:');
    batchResult.conflicts.forEach(c => {
      console.log(`  [${c.type}] ${c.description}`);
      console.log(`    邮件值: ${c.emailValue}, 批次值: ${c.batchValue}`);
      console.log(`    → ${c.actionRequired}`);
    });
  }

  console.log('\n--- Step 2a: 阿南逐一确认冲突 (不自动拍板) ---');
  const conflictTypes = batchResult.conflicts.map(c => c.type);
  for (const conflictType of conflictTypes) {
    const resolveResult = await system.resolveConflict(
      anomalyId,
      conflictType,
      conflictType === 'value_mismatch' ? '以邮件为准，金额为0是冲正导致' : '以邮件状态为准',
      '阿南'
    );
    console.log(`  解决 ${conflictType}:`, resolveResult.message);
    console.log(`  status: ${resolveResult.anomaly.statusText}, nextStep: ${resolveResult.nextStep}`);
  }

  console.log('\n--- Step 2b: 风控同事复核确认 ---');
  const riskResult = await system.confirmByRisk(anomalyId, 'confirm', '风控-李四');
  console.log('结果:', riskResult.message);
  console.log('status:', riskResult.anomaly.statusText);
  console.log('nextStep:', riskResult.nextStep);

  console.log('\n--- Step 3: 生成负责人摘要 ---');
  const summaryResult = await system.generateSummary(anomalyId, {
    summary: '金额为0系冲正导致，风控已确认冲正有效，估值偏离已解释',
    conclusion: 'normal',
    reviewedBy: '风控-李四'
  }, '支付平台产品-阿南');
  console.log('结果:', summaryResult.message);
  console.log('workflowStep:', summaryResult.anomaly.workflowStep);
  console.log('status:', summaryResult.anomaly.statusText);
  console.log('completed:', summaryResult.completed);

  console.log('\n--- 场景1 核查 ---');
  const ws1 = system.getWorkflowStatus(anomalyId);
  console.log('当前流程步骤:', ws1.currentStep, '-', ws1.currentStepDescription);
  console.log('状态:', ws1.statusText);
  console.log('未解决冲突:', ws1.unresolvedConflicts);
  console.log('摘要:', summaryResult.anomaly.summary || '(无)');

  console.log('\n\n【场景2】自检 + 数据一致性 (基于场景1的记录)');
  console.log('========================================================');

  const selfCheckResult = await system.runSelfCheck(anomalyId);
  console.log('自检总体结果:', selfCheckResult.overallPass ? '通过' : '未通过');
  console.log('  重复导入检测:', selfCheckResult.duplicateImport.pass ? '通过' : '未通过');
  console.log('  零值冲正检测:', selfCheckResult.zeroWithReversal.pass ? '通过' : '未通过');
  console.log('  补录重算检测:', selfCheckResult.recalcAfterSupplement.pass ? '通过' : '未通过');
  console.log('  导出一致性检测:', selfCheckResult.exportConsistency.pass ? '通过' : '未通过');

  const viewData = system.getViewData(anomalyId);
  const exportData = system.getExportData(anomalyId);
  const apiData = system.getApiResponse(anomalyId);

  console.log('\n关键字段一致性 (页面/导出/接口):');
  const keyFields = ['marketValue', 'status', 'isZeroWithReversal', 'remark'];
  keyFields.forEach(field => {
    const consistent = viewData[field] === exportData[field] && viewData[field] === apiData[field];
    console.log(`  ${field}: ${consistent ? '✓ 一致' : '✗ 不一致'}`);
    console.log(`    页面=${viewData[field]}, 导出=${exportData[field]}, 接口=${apiData[field]}`);
  });

  console.log('\n\n【场景3】计算参数版本和取舍理由');
  console.log('========================================================');

  system.setCalculation(anomalyId, {
    securityCode: '000001.SZ',
    marketPrice: 12.5,
    quantity: 120000,
    marketAdjustment: 0,
    historicalVolatility: 0.015,
    remark: '该笔交易已冲正'
  }, 'v2.0');

  const calcDetails = system.getCalculationDetails(anomalyId);
  if (calcDetails.calculationDetails) {
    console.log('计算参数展示:');
    console.log(`  ${calcDetails.calculationDetails.displayText}`);
    console.log(`  版本: ${calcDetails.calculationDetails.version}`);
  }

  console.log('\n\n【场景4】无冲突正常记录 — 完整三步流程');
  console.log('========================================================');

  const emailResult2 = await system.importEmail({
    securityCode: '600519.SH',
    securityName: '贵州茅台',
    marketValue: 1800000,
    calculatedValue: 1850000,
    deviation: 50000,
    deviationRate: 0.0278,
    remark: '正常估值',
    emailId: 'EMAIL-2024-002',
    status: 'pending'
  }, '客户经理-王五');
  console.log('Step1 邮件导入:', emailResult2.message);
  const anomalyId2 = emailResult2.anomaly.id;

  const batchResult2 = await system.importBatch(anomalyId2, {
    batchNo: 'BATCH-2024-0601-009',
    marketValue: 1800000,
    status: 'pending',
    operator: '阿南'
  }, '支付平台产品-阿南');
  console.log('Step2 批次导入:', batchResult2.message);
  console.log('是否有冲突:', batchResult2.hasConflicts ? '是' : '否');

  const summaryResult2 = await system.generateSummary(anomalyId2, {
    summary: '估值偏离率2.78%，在3%阈值范围内，建议标记为正常',
    conclusion: 'normal',
    reviewedBy: '阿南'
  }, '支付平台产品-阿南');
  console.log('Step3 生成摘要:', summaryResult2.message);
  console.log('workflowStep:', summaryResult2.anomaly.workflowStep);
  console.log('status:', summaryResult2.anomaly.statusText);

  console.log('\n\n========== 系统整体概览 ==========');
  const summary = system.getSummary();
  console.log('总记录数:', summary.total);
  console.log('待风控复核:', summary.requiresRiskReview);
  console.log('存在冲突:', summary.hasConflicts);
  console.log('按状态统计:', JSON.stringify(summary.byStatus));

  console.log('\n========== 演示完成 ==========');
}

runDemo().catch(console.error);
