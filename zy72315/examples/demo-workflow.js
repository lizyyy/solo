const { ThreeStepWorkflow, UnifiedResultExporter } = require('../src');

async function runDemo() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         A/B 实验提前停止判断 - 完整工作流演示                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const workflow = new ThreeStepWorkflow();
  const exporter = new UnifiedResultExporter();

  const boundaryData = [
    { lineNumber: 2, mainProcess: '首页浏览-下单', numerator: 156, denominator: 1200 },
    { lineNumber: 3, mainProcess: '购物车-支付', numerator: 89, denominator: '' },
    { lineNumber: 4, mainProcess: '搜索-点击', numerator: 432, denominator: 5600 },
    { lineNumber: 5, mainProcess: '商品详情-收藏', numerator: 67, denominator: 0 },
    { lineNumber: 6, mainProcess: '新人-注册', numerator: '', denominator: 800 }
  ];

  await workflow.executeStep1(boundaryData, '数据专员小王');

  console.log('\n' + '─'.repeat(60));
  console.log('📋 步骤1完成后 - 边界规则评估结果：');
  workflow.getUnifiedResults().forEach(r => {
    console.log(`  ${r.recordId} | ${r.evidenceSummary.mainProcess}`);
    console.log(`    分子:${r.evaluation.rawInputs.numerator} 分母:${JSON.stringify(r.evaluation.rawInputs.denominator)}`);
    console.log(`    结果: ${r.displayValue}`);
    console.log(`    规则: ${r.evaluation.ruleDescription}`);
    console.log();
  });

  const scoringData = [
    { recordId: 'EXP-001', lineNumber: 2, sceneStatement: '核心转化路径', weight: 0.35 },
    { recordId: 'EXP-002', lineNumber: 3, sceneStatement: '支付环节关键', weight: 0.25 },
    { recordId: 'EXP-003', lineNumber: 4, sceneStatement: '搜索效率指标', weight: 0.20 },
    { recordId: 'EXP-004', lineNumber: 5, sceneStatement: '用户偏好采集', weight: 0.12 },
    { recordId: 'EXP-005', lineNumber: 6, sceneStatement: '新人转化考核', weight: 0.08 }
  ];

  await workflow.executeStep2(scoringData, '阿岚');

  console.log('\n' + '─'.repeat(60));
  console.log('📋 步骤2完成后 - 两边证据齐全的记录：');
  workflow.getUnifiedResults().forEach(r => {
    console.log(`  ${r.recordId} | ${r.evidenceSummary.mainProcess}`);
    console.log(`    现场说法: ${r.evidenceSummary.sceneStatement}`);
    console.log(`    证据齐全: ${r._meta.hasBothEvidence ? '✓' : '✗'}`);
  });

  console.log('\n' + '─'.repeat(60));
  console.log('⚠️  需要数据复核人复核的记录：');
  const needsReview = workflow.getUnifiedResults().filter(r => r.reviewRequired);
  needsReview.forEach(r => {
    console.log(`  ${r.recordId} | ${r.evidenceSummary.mainProcess}`);
    console.log(`    原因: ${r.evaluation.ruleDescription}`);
    console.log(`    边界值行号: ${r.evidenceSummary.boundaryLine}`);
    console.log(`    评分表行号: ${r.evidenceSummary.scoringLine}`);
    r.evaluation.notes.forEach(note => console.log(`    💬 ${note}`));
    console.log();
  });

  const reviewUpdates = [
    {
      recordId: 'EXP-002',
      reviewStatus: {
        status: 'approved',
        reviewer: '数据复核人老李',
        comment: '确认分母为空是业务场景 - 该环节无分母概念'
      }
    },
    {
      recordId: 'EXP-004',
      reviewStatus: {
        status: 'needs_fix',
        reviewer: '数据复核人老李',
        comment: '分母为0请运营确认，暂时不通过'
      },
      manualChange: {
        field: 'reviewComment',
        oldValue: '',
        newValue: '请运营确认分母是否应为样本量',
        reason: '数据存疑，打回运营确认'
      }
    }
  ];

  await workflow.executeStep3(reviewUpdates, '课堂演示');

  console.log('\n' + '─'.repeat(60));
  console.log('📊 步骤3完成后 - 统一结果展示（三处一致）：');
  
  const unifiedResults = workflow.getUnifiedResults();
  
  console.log('\n  📄 导出明细格式:');
  const csvContent = exporter.exportCSVContent(unifiedResults);
  console.log(csvContent.split('\n')[0]);
  console.log(csvContent.split('\n').slice(1, 3).join('\n'));
  console.log('  ... (更多行)');

  console.log('\n  🖥️  页面展示格式:');
  const pageData = exporter.formatForPageDisplay(unifiedResults);
  console.log(`    统计: 共${pageData.statistics.total}条, 需复核${pageData.statistics.needsReview}条`);
  pageData.data.slice(0, 2).forEach(d => {
    console.log(`    ${d.recordId}: ${d.displayValue} (${d.severity})`);
  });

  console.log('\n  🔌 API返回格式:');
  const apiData = exporter.formatForAPI(unifiedResults);
  console.log(`    code: ${apiData.code}, total: ${apiData.data.pagination.total}`);
  apiData.data.records.slice(0, 1).forEach(r => {
    console.log(`    ${r.id}: rule=${r.evaluation.ruleId}, reviewRequired=${r.evaluation.severity === 'needs_review'}`);
  });

  console.log('\n' + '─'.repeat(60));
  console.log('🔍 复核追踪 - 审计日志示例 (EXP-002):');
  const auditTrail = workflow.getAuditTrail('EXP-002');
  auditTrail.forEach(log => {
    console.log(`  [${log.timestamp.slice(0, 19)}] ${log.action}: ${log.note}`);
  });

  console.log('\n' + '═'.repeat(60));
  console.log('✅ 演示完成！');
  console.log('═'.repeat(60));

  console.log('\n📝 关键点总结：');
  console.log('  1. 两边证据统一存储，可追溯原始行号');
  console.log('  2. 分母为空/0 不急着归正常，留给复核人');
  console.log('  3. 页面、导出、API 显示结果完全一致');
  console.log('  4. 人工改动有记录，支持回滚');
  console.log('  5. 规则写在代码和 README 中，不靠口头约定');
}

runDemo().catch(console.error);
