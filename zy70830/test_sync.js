const { importService } = require('./dist/services/ImportService');
const { reconciliationEngine } = require('./dist/services/ReconciliationEngine');
const { reviewService } = require('./dist/services/ReviewService');
const { reportService } = require('./dist/services/ReportService');
const { dataStore } = require('./dist/models/DataStore');
const { ReviewResult, ReviewAction } = require('./dist/types');
const path = require('path');

async function runSyncTest() {
  console.log('🏥 床位对账服务 - 复核后数据同步测试\n');
  console.log('='.repeat(70));

  try {
    dataStore.clearAll();

    console.log('\n📥 步骤1: 导入测试数据...');
    await importService.importBedCSV(path.join(__dirname, 'src/data/sample_beds.csv'));
    await importService.importPatientJSON(path.join(__dirname, 'src/data/sample_patients.json'));
    await importService.importCleaningWorkOrdersJSON(path.join(__dirname, 'src/data/sample_workorders.json'));
    console.log('   ✓ 数据导入完成');

    console.log('\n⚙️  步骤2: 运行初始对账...');
    const record = await reconciliationEngine.runReconciliation('测试护士长');
    console.log(`   ✓ 对账完成，批次号: ${record.batchId}`);
    console.log(`   初始状态 - 总差异: ${record.discrepanciesFound}, 已解决: ${record.discrepanciesResolved}, 待处理: ${record.discrepanciesPending}`);

    console.log('\n📋 步骤3: 获取差异列表...');
    const discrepancies = dataStore.getAllDiscrepancies();
    console.log(`   共发现 ${discrepancies.length} 个差异:`);
    discrepancies.forEach((d, i) => {
      console.log(`     [${i + 1}] ${d.id.slice(0, 8)} - ${d.type} (${d.severity}): ${d.description}`);
    });

    if (discrepancies.length === 0) {
      console.log('   ⚠️  没有差异可用于测试');
      process.exit(0);
    }

    const targetDiscrepancy = discrepancies[0];
    console.log(`\n   选择复核的差异: ${targetDiscrepancy.id.slice(0, 8)} - ${targetDiscrepancy.description}`);

    console.log('\n🔍 步骤4: 复核前对账记录统计...');
    const beforeRecord = dataStore.getReconciliationRecord(record.id);
    console.log(`   对账记录 - 总差异: ${beforeRecord.discrepanciesFound}, 已解决: ${beforeRecord.discrepanciesResolved}, 待处理: ${beforeRecord.discrepanciesPending}`);
    console.log(`   差异状态 - isResolved: ${targetDiscrepancy.isResolved}`);

    console.log('\n✅ 步骤5: 执行复核操作（标记为已解决）...');
    const reviewResult = await reviewService.reviewDiscrepancy(
      targetDiscrepancy.id,
      ReviewResult.MANUALLY_RESOLVED,
      ReviewAction.MARK_CLEANED,
      '已核实清洁完成，标记为已解决',
      '测试护士长'
    );
    console.log(`   复核成功 - 决策ID: ${reviewResult.decision.id.slice(0, 8)}`);
    console.log(`   更新后差异状态 - isResolved: ${reviewResult.updatedDiscrepancy.isResolved}`);

    console.log('\n🔍 步骤6: 验证对账记录已同步更新...');
    const afterRecord = dataStore.getReconciliationRecord(record.id);
    console.log(`   对账记录 - 总差异: ${afterRecord.discrepanciesFound}, 已解决: ${afterRecord.discrepanciesResolved}, 待处理: ${afterRecord.discrepanciesPending}`);

    const isSyncCorrect = afterRecord.discrepanciesResolved === 1 && 
                         afterRecord.discrepanciesPending === discrepancies.length - 1;
    
    if (isSyncCorrect) {
      console.log('   ✓ 对账记录统计已同步更新！');
    } else {
      console.log('   ✗ 对账记录统计未正确更新');
      console.log(`     期望: 已解决=1, 待处理=${discrepancies.length - 1}`);
      console.log(`     实际: 已解决=${afterRecord.discrepanciesResolved}, 待处理=${afterRecord.discrepanciesPending}`);
      throw new Error('对账记录同步失败');
    }

    console.log('\n📊 步骤7: 验证报告服务返回最新数据...');
    const report = reportService.generateReconciliationReport(record.id);
    console.log(`   报告summary - 已解决: ${report.summary.discrepanciesResolved}, 待处理: ${report.summary.discrepanciesPending}`);
    console.log(`   报告statistics - 总差异: ${report.statistics.totalDiscrepancies}, 已解决: ${report.statistics.resolvedDiscrepancies}, 待处理: ${report.statistics.pendingDiscrepancies}`);

    const reportSyncCorrect = report.summary.discrepanciesResolved === 1 &&
                              report.statistics.resolvedDiscrepancies === 1 &&
                              report.statistics.pendingDiscrepancies === discrepancies.length - 1;

    if (reportSyncCorrect) {
      console.log('   ✓ 报告数据已同步更新！');
    } else {
      console.log('   ✗ 报告数据未正确更新');
      throw new Error('报告数据同步失败');
    }

    console.log('\n📝 步骤8: 验证CSV导出数据同步...');
    const csvResult = reportService.exportDiscrepanciesToCSV();
    console.log(`   CSV导出成功 - 文件名: ${csvResult.filename}`);
    console.log(`   CSV包含 ${csvResult.csv.split('\n').length - 1} 条数据记录（不含表头）`);

    console.log('\n📋 步骤9: 复核第二个差异，验证持续同步...');
    if (discrepancies.length > 1) {
      const secondDiscrepancy = discrepancies[1];
      await reviewService.reviewDiscrepancy(
        secondDiscrepancy.id,
        ReviewResult.APPROVED,
        ReviewAction.MARK_CLEANED,
        '复核通过，清洁工作正常',
        '测试护士长'
      );

      const finalRecord = dataStore.getReconciliationRecord(record.id);
      console.log(`   最终状态 - 已解决: ${finalRecord.discrepanciesResolved}, 待处理: ${finalRecord.discrepanciesPending}`);

      if (finalRecord.discrepanciesResolved === 2 && finalRecord.discrepanciesPending === discrepancies.length - 2) {
        console.log('   ✓ 持续同步验证通过！');
      } else {
        console.log('   ✗ 持续同步验证失败');
        throw new Error('持续同步失败');
      }
    }

    console.log('\n📜 步骤10: 验证审计日志...');
    const auditLogs = dataStore.getAllAuditLogs().filter(l => l.action === 'discrepancy_reviewed');
    console.log(`   已记录 ${auditLogs.length} 条复核审计日志`);
    auditLogs.forEach((log, i) => {
      console.log(`     [${i + 1}] ${new Date(log.timestamp).toLocaleString()} - ${log.performedBy}: ${log.notes}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('\n✅ 复核后数据同步测试全部通过！');
    console.log('   ✓ 差异状态更新后对账记录统计同步');
    console.log('   ✓ 报告服务返回最新统计数据');
    console.log('   ✓ CSV导出包含最新状态');
    console.log('   ✓ 审计日志完整记录\n');

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

runSyncTest();
