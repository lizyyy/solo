const NuclearDensityPeakAnalysis = require('../src/index');
const path = require('path');
const fs = require('fs');

async function generateBoundaryReport() {
  console.log('='.repeat(70));
  console.log('核密度客流峰值 - 边界样本报告');
  console.log('='.repeat(70));
  console.log();

  const analysis = new NuclearDensityPeakAnalysis({
    dataDir: './data',
    calculator: { bandwidth: 30, gridSize: 50 }
  });

  const part1Path = path.join(__dirname, '../data/raw/sample-flow-data-part1.csv');
  await analysis.importData(part1Path, '边界报告-初始数据');

  const part2Path = path.join(__dirname, '../data/raw/sample-flow-data-part2-supplement.csv');
  await analysis.importData(part2Path, '边界报告-补录数据');

  analysis.analyze('flow');

  const boundaryCases = analysis.getBoundaryCases();
  const negativeSamples = analysis.getNegativeSamples();
  const manualExamples = analysis.getManualCalculationExamples();

  console.log('【边界案例汇总】');
  console.log('-'.repeat(70));
  console.log(`边界案例总数: ${boundaryCases.length}`);
  console.log(`  - 待人工复核 (pending_review): ${boundaryCases.filter(b => b._meta.status === 'pending_review').length}`);
  console.log(`  - 边界案例标记 (boundary_case): ${boundaryCases.filter(b => b._meta.status === 'boundary_case').length}`);
  console.log(`负数样本数: ${negativeSamples.length}`);
  console.log(`手算反例数: ${manualExamples.length}`);
  console.log();

  console.log('【手算反例详细信息 - 学生助教复核用】');
  console.log('-'.repeat(70));
  console.log();

  manualExamples.forEach((ex, idx) => {
    console.log(`反例 #${idx + 1}`);
    console.log(`  原始行号: ${ex.originalLineNumber}`);
    console.log(`  当前状态: ${ex.currentStatus}`);
    console.log(`  原始数据: ${JSON.stringify(ex.rawData)}`);
    
    if (ex.issues.length > 0) {
      console.log(`  问题列表 (${ex.issues.length}个):`);
      ex.issues.forEach((issue, i) => {
        console.log(`    [${i + 1}] ${issue.field}: ${issue.message} (严重度: ${issue.severity})`);
      });
    }
    
    if (ex.manualEdits.length > 0) {
      console.log(`  人工改动 (${ex.manualEdits.length}条):`);
      ex.manualEdits.forEach((edit, i) => {
        console.log(`    [${i + 1}] ${edit.field}: ${edit.oldValue} → ${edit.newValue}`);
        console.log(`        原因: ${edit.reason}`);
        console.log(`        操作人: ${edit.operator}`);
        console.log(`        时间: ${edit.timestamp}`);
      });
    }
    console.log();
  });

  console.log('【学生助教复核指引】');
  console.log('-'.repeat(70));
  console.log('1. 检查所有标记为 pending_review 的记录');
  console.log('2. 核对问卷原始行，确认负数样本是否为录入错误');
  console.log('3. 对确认无误的样本，使用 applyManualEdit 更正数据并注明原因');
  console.log('4. 复核完成后，运行 recalculateAfterSupplement 重算峰值');
  console.log('5. 导出最终报告前确认一致性检查通过');
  console.log();

  console.log('【当前待复核清单】');
  console.log('-'.repeat(70));
  const pendingReview = boundaryCases.filter(b => b._meta.status === 'pending_review');
  
  if (pendingReview.length === 0) {
    console.log('✓ 暂无待复核记录');
  } else {
    pendingReview.forEach((r, idx) => {
      console.log(`${idx + 1}. 行${r._meta.originalLineNumber}: ${JSON.stringify(Object.fromEntries(
        Object.entries(r).filter(([k]) => !k.startsWith('_'))
      ))}`);
      console.log(`   问题: ${r._meta.issues.map(i => i.message).join('; ')}`);
    });
  }
  console.log();

  const reportData = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalRecords: analysis.dataManager.rawRecords.length,
      boundaryCases: boundaryCases.length,
      negativeSamples: negativeSamples.length,
      pendingReview: pendingReview.length,
      manualCalculationExamples: manualExamples.length
    },
    pendingReviewList: pendingReview.map(r => ({
      originalLineNumber: r._meta.originalLineNumber,
      rawData: Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('_'))),
      issues: r._meta.issues
    })),
    manualCalculationAudit: manualExamples
  };

  const reportPath = path.join(__dirname, '../data/audit', 'boundary-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  
  console.log(`完整边界样本报告已保存: ${reportPath}`);
  console.log();

  const consistency = analysis.getConsistencyCheck();
  console.log('【数据一致性状态】');
  console.log('-'.repeat(70));
  console.log(`一致性检查: ${consistency.consistent ? '✅ 通过' : '❌ 不通过'}`);
  if (!consistency.consistent) {
    consistency.issues.forEach(i => console.log(`  - ${i.message}`));
  }
  console.log();

  console.log('='.repeat(70));
  console.log('报告生成完成！');
  console.log('='.repeat(70));
}

generateBoundaryReport().catch(console.error);
