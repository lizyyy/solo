const store = require('../server/models/store');
const selfCheck = require('../server/services/selfCheck');
const workflow = require('../server/services/workflow');
const unifiedData = require('../server/services/unifiedData');

async function runTests() {
  console.log('\n🧪 开始运行自检模块测试...\n');
  store.clearAll();

  const run = await workflow.createRun('测试校准任务');
  const runId = run.id;
  console.log(`✅ 创建测试任务: ${runId}`);

  const samples = [
    { userId: 'u1', itemId: 'i1', predictedProb: 0.72, calibratedProb: 0.68, label: 0, features: { user_age: 28, user_gender: 'M', item_category: '3C', item_price: 2999, user_hist_click_cnt: 156 } },
    { userId: 'u2', itemId: 'i2', predictedProb: 0.50, calibratedProb: 0.50, label: 0, features: { user_age: null, user_gender: '', item_category: '', item_price: 0, user_hist_click_cnt: NaN } },
    { userId: 'u1', itemId: 'i1', predictedProb: 0.72, calibratedProb: 0.68, label: 0, features: { user_age: 28, user_gender: 'M', item_category: '3C', item_price: 2999, user_hist_click_cnt: 156 } },
    { userId: 'u3', itemId: 'i3', predictedProb: 0.50, calibratedProb: 0.50, label: 0, features: { user_age: 30, user_gender: null, item_category: '食品', item_price: 59, user_hist_click_cnt: undefined } },
  ];

  const importResult = await workflow.importNegativeSamples(runId, samples);
  console.log(`✅ 导入样本: ${importResult.imported} 条, 待复核: ${importResult.needReview} 条`);

  console.log('\n--- 测试 1: 重复导入检测 ---');
  const dupResult = selfCheck.checkDuplicateImport(runId);
  console.log(`   重复导入检测: ${dupResult.passed ? '✅ 通过' : '❌ 未通过'}`);
  console.log(`   发现重复: ${dupResult.details.duplicateCount} 条`);
  if (dupResult.issues.length > 0) {
    dupResult.issues.forEach(i => console.log(`     - 行${i.rowNumber} 与 行${i.previousRow} 重复`));
  }

  console.log('\n--- 测试 2: 特征缺失/默认分检测 ---');
  const missResult = selfCheck.checkMissingFeatureDefault(runId);
  console.log(`   特征缺失检测: ${missResult.passed ? '✅ 通过' : '❌ 未通过'}`);
  console.log(`   特征缺失样本: ${missResult.details.missingFeatureCount} 条`);
  console.log(`   待负责人复核: ${missResult.details.pendingReviewCount} 条`);
  missResult.issues.forEach(i => {
    console.log(`     - 行${i.rowNumber}: 缺失特征=[${i.missingFeatureList.join(',')}], 默认分=${i.usedDefaultScore}`);
  });

  console.log('\n--- 测试 3: 补录后重算检测 ---');
  const sampleToRecompute = store.getNegativeSamples(runId).find(s => s.usedDefaultScore);
  if (sampleToRecompute) {
    await workflow.recomputeSample(runId, sampleToRecompute.id, {
      features: { user_age: 25, user_gender: 'F', item_category: '美妆', item_price: 199, user_hist_click_cnt: 42 },
      calibratedProb: 0.32
    }, '测试用户');
    console.log(`   已对行${sampleToRecompute.originalRowNumber}进行补录重算`);
  }

  const recomputeResult = selfCheck.checkRecomputeAfterFill(runId);
  console.log(`   补录重算检测: ${recomputeResult.passed ? '✅ 通过' : '❌ 未通过'}`);
  console.log(`   含人工修改: ${recomputeResult.details.withManualEdits} 条, 需重算: ${recomputeResult.details.needRecompute} 条`);

  console.log('\n--- 测试 4: 导出一致性检测 ---');
  const consistencyResult = selfCheck.checkExportConsistency(runId);
  console.log(`   导出一致性检测: ${consistencyResult.passed ? '✅ 通过' : '❌ 未通过'}`);
  if (consistencyResult.issues.length > 0) {
    consistencyResult.issues.forEach(i => console.log(`     - ${JSON.stringify(i)}`));
  }

  console.log('\n--- 测试 5: 统一数据层一致性 ---');
  const verifyResult = unifiedData.verifyConsistency(runId);
  console.log(`   数据一致性: ${verifyResult.consistent ? '✅ 通过' : '❌ 未通过'}`);
  console.log(`   列表:${verifyResult.counts.list} 条, API:${verifyResult.counts.api} 条, 导出:${verifyResult.counts.export} 条`);

  console.log('\n--- 测试 6: 特征缺失样本禁止直接标记正常 ---');
  const missingSample = store.getNegativeSamples(runId).find(s => s.hasMissingFeatures && s.status === 'pending_review');
  if (missingSample) {
    try {
      await workflow.markNormal(runId, missingSample.id, '测试用户');
      console.log('   ❌ 错误: 特征缺失样本不应被直接标记为正常');
    } catch (e) {
      console.log(`   ✅ 正确拦截: ${e.message}`);
    }
  }

  console.log('\n--- 测试 7: 三步工作流状态 ---');
  const state = await workflow.getWorkflowState(runId);
  console.log(`   当前步骤: ${state.currentStep} - ${state.stepNames[state.currentStep]}`);
  console.log(`   统计: 总${state.stats.total}, 待复核${state.stats.pendingReview}, 特征缺失${state.stats.hasMissingFeatures}, 默认分${state.stats.usedDefaultScore}`);

  console.log('\n--- 测试 8: 人工改动记录保留 ---');
  const editedSample = store.getNegativeSamples(runId).find(s => s.manualEdits && s.manualEdits.length > 0);
  if (editedSample) {
    console.log(`   行${editedSample.originalRowNumber} 有 ${editedSample.manualEdits.length} 条改动记录:`);
    editedSample.manualEdits.forEach(e => {
      console.log(`     - ${e.timestamp} ${e.field}: ${JSON.stringify(e.oldValue)} → ${JSON.stringify(e.newValue)}`);
    });
  }

  const finalResults = selfCheck.runAllChecks(runId);
  console.log(`\n📊 自检汇总: ${finalResults.passed}/${finalResults.total} 通过, ${finalResults.failed} 失败\n`);

  store.clearAll();
  console.log('🧹 测试数据已清理\n');
}

runTests().catch(console.error);
