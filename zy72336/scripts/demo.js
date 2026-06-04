const NuclearDensityPeakAnalysis = require('../src/index');
const path = require('path');

async function runDemo() {
  console.log('='.repeat(70));
  console.log('核密度客流峰值分析系统 - 完整演示');
  console.log('='.repeat(70));
  console.log();

  const analysis = new NuclearDensityPeakAnalysis({
    dataDir: './data',
    calculator: { bandwidth: 30, gridSize: 50 }
  });

  console.log('【第一步】第一次导入 - 运营规划阿岚初始导入数据');
  console.log('-'.repeat(70));
  
  const part1Path = path.join(__dirname, '../data/raw/sample-flow-data-part1.csv');
  const importResult1 = await analysis.importData(part1Path, '初始导入-客流数据');
  
  console.log(`导入成功: ${importResult1.recordCount} 条记录`);
  console.log(`发现问题: ${importResult1.issues.length} 个`);
  importResult1.issues.forEach(issue => {
    console.log(`  - 行${issue.originalLineNumber}: ${issue.message}`);
  });
  console.log();

  console.log('【第一步续】运行分析并查看手算反例');
  console.log('-'.repeat(70));
  
  analysis.analyze('flow');
  
  const manualExamples = analysis.getManualCalculationExamples();
  console.log(`手算反例记录: ${manualExamples.length} 条`);
  manualExamples.forEach(ex => {
    console.log(`  - 原始行号 ${ex.originalLineNumber}: 状态=${ex.currentStatus}`);
    ex.issues.forEach(i => console.log(`    * 问题: ${i.field} - ${i.message}`));
  });
  console.log();

  console.log('【第二步】模拟问卷原始行补录 - 群里补充的问卷数据');
  console.log('-'.repeat(70));
  
  const part2Path = path.join(__dirname, '../data/raw/sample-flow-data-part2-supplement.csv');
  const importResult2 = await analysis.importData(part2Path, '补录导入-问卷补充数据');
  
  console.log(`补录成功: ${importResult2.recordCount} 条记录`);
  console.log(`发现问题: ${importResult2.issues.length} 个`);
  console.log();

  console.log('【第二步续】补录后重算');
  console.log('-'.repeat(70));
  
  const resultsAfterSupplement = analysis.recalculateAfterSupplement();
  console.log(`重算后峰值数量: ${resultsAfterSupplement.peaks.length}`);
  resultsAfterSupplement.peaks.forEach((p, idx) => {
    console.log(`  峰值${idx + 1}: 位置=${p.position.toFixed(2)}, 密度=${p.density.toFixed(4)}`);
  });
  console.log();

  console.log('【第三步】阿岚人工复核 - 负数样本处理');
  console.log('-'.repeat(70));
  
  const negativeSamples = analysis.getNegativeSamples();
  console.log(`待复核的负数样本: ${negativeSamples.length} 条`);
  
  if (negativeSamples.length > 0) {
    const recordIndex = analysis.dataManager.rawRecords.indexOf(negativeSamples[0]);
    
    const edit = analysis.applyManualEdit(
      recordIndex,
      'flow',
      '50',
      '问卷核对后确认应为50，原录入错误',
      '运营规划-阿岚'
    );
    
    console.log(`人工修改: 行${edit.originalLineNumber}, ${edit.field}: ${edit.oldValue} → ${edit.newValue}`);
    console.log(`原因: ${edit.reason}`);
    console.log(`操作人: ${edit.operator}`);
  }
  console.log();

  console.log('【第三步续】人工修改后重算');
  console.log('-'.repeat(70));
  
  const resultsAfterEdit = analysis.recalculateAfterSupplement();
  console.log(`修改后重算 - 峰值数量: ${resultsAfterEdit.peaks.length}`);
  resultsAfterEdit.peaks.forEach((p, idx) => {
    console.log(`  峰值${idx + 1}: 位置=${p.position.toFixed(2)}, 密度=${p.density.toFixed(4)}`);
  });
  console.log();

  console.log('【导出一致性检查】');
  console.log('-'.repeat(70));
  
  const consistency = analysis.getConsistencyCheck();
  console.log(`数据一致性: ${consistency.consistent ? '通过' : '不通过'}`);
  console.log(`统计: 总记录=${consistency.summary.totalRecords}, 边界案例=${consistency.summary.boundaryCases}, 负数样本=${consistency.summary.negativeSamples}`);
  if (!consistency.consistent) {
    consistency.issues.forEach(i => console.log(`  问题: ${i.message}`));
  }
  console.log();

  console.log('【导出所有报告】');
  console.log('-'.repeat(70));
  
  const exportResults = analysis.export('./data/exports');
  console.log('导出文件:');
  Object.entries(exportResults).forEach(([key, result]) => {
    console.log(`  ${key}: ${result.filePath} (${result.recordCount}条)`);
  });
  console.log();

  console.log('【页面展示数据预览】');
  console.log('-'.repeat(70));
  
  const pageData = analysis.getPageDisplayData();
  console.log(`概览: 总记录=${pageData.overview.totalRecords}, 峰值=${pageData.overview.peakCount}, 待复核=${pageData.overview.pendingReviewCount}`);
  console.log(`边界案例: ${pageData.boundaryCases.length} 条`);
  console.log(`审计轨迹: ${pageData.auditTrail.length} 条`);
  console.log();

  console.log('【API响应预览】');
  console.log('-'.repeat(70));
  
  const apiResponse = analysis.getAPIResponse();
  console.log(`API状态: ${apiResponse.success ? '成功' : '失败'}`);
  console.log(`一致性检查: ${apiResponse.data.consistencyCheck.consistent ? '通过' : '不通过'}`);
  console.log();

  console.log('='.repeat(70));
  console.log('演示完成！完整流程已覆盖：');
  console.log('  ✓ 第一次导入（含负数、缺失值检测）');
  console.log('  ✓ 问卷原始行补录后重算');
  console.log('  ✓ 人工复核负数样本');
  console.log('  ✓ 导出一致性检查');
  console.log('  ✓ 手算反例追踪（原始行号+人工改动+处理状态）');
  console.log('  ✓ 页面/API/导出同一份数据源');
  console.log('='.repeat(70));
}

runDemo().catch(console.error);
