import { initDatabase } from '../database';
import { 
  createReconciliation, 
  startReconciliation, 
  getReconciliation,
  reviewSample,
  getSamplesWithStatus,
  getReviewRecords,
} from '../services/reviewService';
import { 
  getAllDiscrepanciesWithExplanation, 
  getSampleDiscrepanciesWithExplanation,
  getDecisionSupport,
} from '../services/explanationService';
import { generateReportData, generateSummaryHtml, generateExcelReport } from '../services/reportService';
import * as fs from 'fs';
import * as path from 'path';

async function testFlow() {
  console.log('='.repeat(80));
  console.log('检测站对账服务 - 完整流程测试');
  console.log('='.repeat(80));

  await initDatabase();

  console.log('\n📋 步骤1: 创建对账会话');
  const reconciliation = await createReconciliation(
    'BATCH20240501',
    '2024年5月第一批次对账',
    '接样员张三'
  );
  console.log(`   ✓ 对账会话已创建: ${reconciliation.id}`);

  console.log('\n🔍 步骤2: 执行自动比对');
  const processed = await startReconciliation(reconciliation.id);
  if (!processed) {
    console.error('   ✗ 对账处理失败');
    return;
  }
  console.log(`   ✓ 比对完成: 总样品 ${processed.total_samples}, 匹配 ${processed.matched_samples}, 不匹配 ${processed.mismatched_samples}`);
  console.log(`   ✓ 发现差异: ${processed.discrepancies_count} 条, 已解决: ${processed.resolved_discrepancies}`);

  console.log('\n📊 步骤3: 获取差异详情（带解释）');
  const discrepancies = await getAllDiscrepanciesWithExplanation(reconciliation.id);
  console.log(`   共发现 ${discrepancies.length} 条差异:`);
  discrepancies.forEach((d, i) => {
    console.log(`\n   ${i + 1}. [${d.severityLabel}] ${d.typeLabel} - ${d.sampleNo}`);
    console.log(`      描述: ${d.description}`);
    console.log(`      根本原因: ${d.rootCause}`);
    console.log(`      影响: ${d.impact}`);
    console.log(`      建议: ${d.suggestedActions[0]}`);
  });

  console.log('\n👀 步骤4: 查看样品 S202405002 的差异详情（需要人工修正的记录）');
  const sampleDiscrepancies = await getSampleDiscrepanciesWithExplanation(reconciliation.id, 'S202405002');
  sampleDiscrepancies.forEach((d, i) => {
    console.log(`\n   差异 ${i + 1}:`);
    console.log(`      类型: ${d.typeLabel} (${d.severityLabel})`);
    console.log(`      描述: ${d.description}`);
    console.log(`      预期值: ${d.expectedValue}`);
    console.log(`      实际值: ${d.actualValue}`);
    console.log(`      根本原因: ${d.rootCause}`);
    console.log(`      建议操作:`);
    d.suggestedActions.forEach((action, j) => {
      console.log(`        ${j + 1}. ${action}`);
    });
  });

  console.log('\n🤔 步骤5: 获取决策支持 - 样品 S202405002');
  const decisionSupport = await getDecisionSupport('S202405002', 'BATCH20240501', reconciliation.id);
  console.log(`   可放行: ${decisionSupport.canApprove}`);
  console.log(`   可退回: ${decisionSupport.canReject}`);
  console.log(`   可要求补材料: ${decisionSupport.canRequestSupplement}`);
  console.log(`   建议: ${decisionSupport.recommendation}`);
  if (decisionSupport.warnings.length > 0) {
    console.log(`   警告:`);
    decisionSupport.warnings.forEach(w => console.log(`     - ${w}`));
  }
  if (decisionSupport.justification.length > 0) {
    console.log(`   依据:`);
    decisionSupport.justification.forEach(j => console.log(`     - ${j}`));
  }

  console.log('\n✅ 步骤6: 人工复核 - 放行样品 S202405001');
  const review1 = await reviewSample(
    reconciliation.id,
    'S202405001',
    'approve',
    '接样员张三',
    '所有检测项目合格，无差异，予以放行'
  );
  if (review1) {
    console.log(`   ✓ 复核记录已创建: ${review1.action} - ${review1.comment}`);
  }

  console.log('\n⚠️  步骤7: 人工复核 - 要求样品 S202405002 补材料');
  const sample2Discrepancies = discrepancies.filter(d => d.sampleNo === 'S202405002');
  const review2 = await reviewSample(
    reconciliation.id,
    'S202405002',
    'supplement',
    '接样员张三',
    '有机磷农药残留超标（0.08mg/kg > 标准0.05mg/kg），需合作社提供农药使用记录并安排复检',
    sample2Discrepancies.map(d => d.discrepancyId)
  );
  if (review2) {
    console.log(`   ✓ 复核记录已创建: ${review2.action} - ${review2.comment}`);
  }

  console.log('\n⚠️  步骤8: 人工复核 - 放行样品 S202405003（复检超窗口但注明原因）');
  const sample3Discrepancies = discrepancies.filter(d => d.sampleNo === 'S202405003');
  const review3 = await reviewSample(
    reconciliation.id,
    'S202405003',
    'approve',
    '接样员张三',
    '复检超窗口原因为仪器故障维修，经质量负责人批准后予以放行，复检结果合格（0.15mg/kg为初检结果，复检0.08mg/kg合格）',
    sample3Discrepancies.map(d => d.discrepancyId)
  );
  if (review3) {
    console.log(`   ✓ 复核记录已创建: ${review3.action} - ${review3.comment}`);
  }

  console.log('\n📋 步骤9: 复核后重新计算对账统计');
  const updated = await getReconciliation(reconciliation.id);
  if (updated) {
    console.log(`   已解决差异: ${updated.resolved_discrepancies} / ${updated.discrepancies_count}`);
  }

  console.log('\n📄 步骤10: 查看复核历史');
  const reviews = await getReviewRecords(reconciliation.id);
  reviews.forEach(r => {
    console.log(`   ${r.created_at}: ${r.sample_no} - ${r.action} (${r.reviewer})`);
    if (r.comment) console.log(`     备注: ${r.comment}`);
  });

  console.log('\n📊 步骤11: 生成报告数据');
  const reportData = await generateReportData(reconciliation.id);
  console.log(`   样品总数: ${reportData.summary.total_samples}`);
  console.log(`   合格率: ${reportData.summary.pass_rate}%`);
  console.log(`   待复核: ${reportData.summary.pending_review}`);

  console.log('\n📄 步骤12: 导出HTML报告');
  const html = generateSummaryHtml(reportData);
  const htmlPath = path.join(__dirname, '../../output/report.html');
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  fs.writeFileSync(htmlPath, html, 'utf-8');
  console.log(`   ✓ HTML报告已保存: ${htmlPath}`);

  console.log('\n📄 步骤13: 导出Excel报告');
  const excelBuffer = generateExcelReport(reportData);
  const excelPath = path.join(__dirname, '../../output/report.xlsx');
  fs.writeFileSync(excelPath, excelBuffer);
  console.log(`   ✓ Excel报告已保存: ${excelPath}`);

  console.log('\n' + '='.repeat(80));
  console.log('✅ 测试流程完成！');
  console.log('='.repeat(80));
  console.log('\n关键数据说明:');
  console.log('  对账ID:', reconciliation.id);
  console.log('  涉及样品: 8个');
  console.log('  需要人工修正的记录:');
  console.log('    - S202405002: 农药残留超标，已要求补材料');
  console.log('    - S202405003: 复检超窗口，已注明原因放行');
  console.log('    - S202405006: 农药残留超标，待处理');
  console.log('\n接样员可通过本系统向他人说明:');
  console.log('  • 为什么 S202405003 被放行：仪器故障导致复检超期，复检结果合格');
  console.log('  • 为什么 S202405002 被要求补材料：农药残留超标需要复核');
  console.log('  • 差异来源：系统自动识别并解释每一条差异的根本原因');
}

testFlow().catch(console.error);
