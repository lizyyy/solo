const generateTestData = require('./testData');
const acceptanceService = require('../src/services/acceptance');
const batchService = require('../src/services/batch');
const queryService = require('../src/services/query');
const inspectionService = require('../src/services/inspection');

async function runTests() {
  console.log('='.repeat(60));
  console.log('  滞留任务清理器 - 功能测试');
  console.log('='.repeat(60));
  console.log('');

  const testData = generateTestData();
  const allItems = [...testData.normalItems, testData.badItem];

  console.log('📋 测试1: 提交验收单（含正常材料和异常材料）');
  console.log('-'.repeat(60));
  console.log(`  正常材料数量: ${testData.normalItems.length}`);
  console.log(`  异常材料数量: 1 (签名算法不一致 - MD5)`);
  console.log('');

  const submitResult = await acceptanceService.submitAcceptanceForm(
    testData.formData,
    allItems
  );

  console.log('  提交结果:');
  console.log(`    验收单ID: ${submitResult.formId}`);
  console.log(`    批次号: ${submitResult.batchNo}`);
  console.log(`    验收单状态: ${submitResult.status}`);
  console.log(`    总计: ${submitResult.total}`);
  console.log(`    成功: ${submitResult.successCount}`);
  console.log(`    失败: ${submitResult.failCount}`);
  console.log('');
  
  submitResult.results.forEach(r => {
    const status = r.status === 'success' ? '✅' : '❌';
    console.log(`    ${status} ${r.itemNo}: ${r.status}`);
    if (r.error) {
      console.log(`       错误: ${r.error}`);
    }
  });
  console.log('');

  const failedDetail = submitResult.results.find(r => r.status === 'failed');
  
  console.log('🔍 测试2: 批量重跑 - 预览影响范围');
  console.log('-'.repeat(60));
  const previewResult = await batchService.previewRerun({});
  console.log(`  预计影响数量: ${previewResult.totalAffected}`);
  previewResult.items.forEach(item => {
    console.log(`    - ${item.itemNo}: ${item.projectName}`);
    console.log(`      错误: ${item.errorMessage}`);
  });
  console.log('');

  console.log('🔄 测试3: 执行批量重跑');
  console.log('-'.repeat(60));
  const rerunResult = await batchService.executeRerun({}, '系统管理员');
  console.log(`  处理数量: ${rerunResult.totalProcessed}`);
  console.log(`  成功: ${rerunResult.successCount}`);
  console.log(`  失败: ${rerunResult.failCount}`);
  console.log('');

  console.log('✏️ 测试4: 修正签名后重跑');
  console.log('-'.repeat(60));
  const badItem = testData.badItem;
  const fixedAlgorithm = 'SHA256';
  const fixedSignature = require('../src/services/signature').generateSignature(
    require('../src/services/signature').getSignContent(badItem),
    fixedAlgorithm
  );
  
  const fixResult = await batchService.fixSignature(
    failedDetail.detailId,
    fixedAlgorithm,
    fixedSignature,
    '张经理'
  );
  console.log(`  明细ID: ${fixResult.detailId}`);
  console.log(`  重跑ID: ${fixResult.rerunId}`);
  console.log(`  状态: ${fixResult.status}`);
  console.log(`  结论: ${fixResult.conclusion}`);
  console.log('');

  console.log('📊 测试5: 统一查询入口');
  console.log('-'.repeat(60));
  const queryResult = await queryService.queryTasks({});
  console.log(`  总记录数: ${queryResult.total}`);
  console.log(`  成功: ${queryResult.successCount}`);
  console.log(`  失败: ${queryResult.failedCount}`);
  console.log(`  待处理: ${queryResult.pendingCount}`);
  console.log('');

  console.log('🔗 测试6: 查询任务追踪（含重跑记录）');
  console.log('-'.repeat(60));
  const traceResult = await queryService.getTaskTrace(failedDetail.detailId);
  console.log(`  项目: ${traceResult.taskDetail.projectName}`);
  console.log(`  重跑次数: ${traceResult.taskDetail.rerunCount}`);
  console.log(`  重跑历史: ${traceResult.rerunHistory.length} 条`);
  traceResult.rerunHistory.forEach((h, idx) => {
    console.log(`    ${idx + 1}. 动作: ${h.action}, 结论: ${h.conclusion}`);
    console.log(`       操作人: ${h.operator}, 时间: ${h.createdAt}`);
  });
  console.log('');

  console.log('📋 测试7: 生成夜间巡检表');
  console.log('-'.repeat(60));
  const inspectionReport = inspectionService.generateNightlyInspection();
  console.log(`  报告ID: ${inspectionReport.id}`);
  console.log(`  巡检日期: ${inspectionReport.inspectionDate}`);
  console.log(`  巡检项数量: ${inspectionReport.items.length}`);
  console.log('');

  console.log('✅ 测试8: 添加复核样例');
  console.log('-'.repeat(60));
  if (inspectionReport.items.length > 0) {
    const reviewedReport = inspectionService.addReviewSample(inspectionReport.id);
    const reviewedItem = reviewedReport.items[0];
    console.log(`  复核项: ${reviewedItem.itemNo}`);
    console.log(`  复核状态: ${reviewedItem.reviewStatus}`);
    console.log(`  复核人: ${reviewedItem.reviewResult.reviewer}`);
    console.log(`  复核意见: ${reviewedItem.reviewResult.reviewComment}`);
  } else {
    console.log('  当前无异常任务需要复核');
  }
  console.log('');

  console.log('📈 测试9: 查询统计信息');
  console.log('-'.repeat(60));
  const stats = await queryService.getStatistics();
  console.log(`  验收单数: ${stats.totalForms}`);
  console.log(`  明细总数: ${stats.totalDetails}`);
  console.log(`  成功明细: ${stats.successDetails}`);
  console.log(`  失败明细: ${stats.failedDetails}`);
  console.log(`  有重跑记录: ${stats.hasRerunCount}`);
  console.log('');

  console.log('='.repeat(60));
  console.log('  ✅ 所有测试完成!');
  console.log('='.repeat(60));
}

runTests().catch(console.error);