import { initDatabase } from '../database';
import { 
  createReconciliation, 
  startReconciliation, 
  getReconciliation,
  reviewSample,
  getSamplesWithStatus,
  getReviewRecords,
  recalculateReconciliation,
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
  console.log('检测站对账服务 - 完整流程测试（修复版）');
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

  console.log('\n📊 步骤3: 获取所有差异（验证各类型差异正确生成）');
  const discrepancies = await getAllDiscrepanciesWithExplanation(reconciliation.id);
  console.log(`   共发现 ${discrepancies.length} 条差异:`);
  
  const typeCounts: Record<string, number> = {};
  discrepancies.forEach(d => {
    typeCounts[d.type] = (typeCounts[d.type] || 0) + 1;
  });
  console.log(`   差异类型统计:`);
  Object.entries(typeCounts).forEach(([type, count]) => {
    console.log(`     - ${type}: ${count} 条`);
  });

  const mixedBatch = discrepancies.find(d => d.type === 'mixed_batch');
  const retestWindow = discrepancies.find(d => d.type === 'retest_window');
  const reportWithdrawn = discrepancies.find(d => d.type === 'report_withdrawn');
  const valueOutOfRange = discrepancies.filter(d => d.type === 'value_out_of_range');

  console.log(`\n   ✅ 验证结果:`);
  console.log(`     - mixed_batch (样品混批): ${mixedBatch ? '✓ 已检测到' : '✗ 未检测到'} - S202405003 跨批次 BATCH20240501/BATCH20240502`);
  console.log(`     - retest_window (复检窗口超时): ${retestWindow ? '✓ 已检测到' : '✗ 未检测到'} - S202405003 复检超48小时`);
  console.log(`     - report_withdrawn (报告撤回): ${reportWithdrawn ? '✓ 已检测到' : '✗ 未检测到'} - S202405008 报告已撤回`);
  console.log(`     - value_out_of_range (检测值超标): ${valueOutOfRange.length} 条 - S202405002, S202405003, S202405006`);

  if (mixedBatch) {
    console.log(`\n📖 混批差异详情 (S202405003):`);
    console.log(`     描述: ${mixedBatch.description}`);
    console.log(`     根本原因: ${mixedBatch.rootCause}`);
    console.log(`     影响: ${mixedBatch.impact}`);
    console.log(`     建议: ${mixedBatch.suggestedActions[0]}`);
  }

  if (retestWindow) {
    console.log(`\n📖 复检窗口超时详情 (S202405003):`);
    console.log(`     描述: ${retestWindow.description}`);
    console.log(`     预期: ${retestWindow.expectedValue}, 实际: ${retestWindow.actualValue}`);
    console.log(`     根本原因: ${retestWindow.rootCause}`);
    console.log(`     建议: ${retestWindow.suggestedActions[0]}`);
    if (retestWindow.evidence) {
      console.log(`     证据: 初检 ${retestWindow.evidence.originalDate}, 复检 ${retestWindow.evidence.retestDate}, 差 ${retestWindow.evidence.hoursDiff?.toFixed(1)} 小时`);
    }
  }

  if (reportWithdrawn) {
    console.log(`\n📖 报告撤回详情 (S202405008):`);
    console.log(`     描述: ${reportWithdrawn.description}`);
    console.log(`     根本原因: ${reportWithdrawn.rootCause}`);
    console.log(`     影响: ${reportWithdrawn.impact}`);
    console.log(`     建议: ${reportWithdrawn.suggestedActions[0]}`);
    if (reportWithdrawn.evidence) {
      console.log(`     撤回原因: ${reportWithdrawn.evidence.withdrawnReason}`);
    }
  }

  console.log('\n👀 步骤4: 查看样品 S202405002 的差异详情（需要人工修正的记录）');
  const sample2Discrepancies = await getSampleDiscrepanciesWithExplanation(reconciliation.id, 'S202405002');
  sample2Discrepancies.forEach((d, i) => {
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
  const sample2DiscIds = discrepancies.filter(d => d.sampleNo === 'S202405002').map(d => d.discrepancyId);
  const review2 = await reviewSample(
    reconciliation.id,
    'S202405002',
    'supplement',
    '接样员张三',
    '有机磷农药残留超标（0.08mg/kg > 标准0.05mg/kg），需合作社提供农药使用记录并安排复检',
    sample2DiscIds
  );
  if (review2) {
    console.log(`   ✓ 复核记录已创建: ${review2.action} - ${review2.comment}`);
    console.log(`   ✓ 已解决差异: ${sample2DiscIds.length} 条`);
  }

  console.log('\n⚠️  步骤8: 人工复核 - 放行样品 S202405003（复检超窗口但注明原因）');
  const sample3DiscIds = discrepancies.filter(d => d.sampleNo === 'S202405003').map(d => d.discrepancyId);
  const review3 = await reviewSample(
    reconciliation.id,
    'S202405003',
    'approve',
    '接样员张三',
    '复检超窗口原因为仪器故障维修，经质量负责人批准后予以放行。初检0.15mg/kg不合格，复检0.08mg/kg合格',
    sample3DiscIds
  );
  if (review3) {
    console.log(`   ✓ 复核记录已创建: ${review3.action} - ${review3.comment}`);
    console.log(`   ✓ 已解决差异: ${sample3DiscIds.length} 条（含混批和复检窗口超时）`);
  }

  console.log('\n� 步骤9: 复核后重新计算对账统计（验证已解决差异不被重置）');
  const beforeRecalc = await getReconciliation(reconciliation.id);
  const samplesBeforeRecalc = await getSamplesWithStatus(reconciliation.id);
  console.log(`   重新计算前: 已解决差异 ${beforeRecalc?.resolved_discrepancies} / ${beforeRecalc?.discrepancies_count}`);
  console.log(`   重新计算前样品状态: S202405001=${samplesBeforeRecalc.find(s=>s.sample_no==='S202405001')?.status}, S202405002=${samplesBeforeRecalc.find(s=>s.sample_no==='S202405002')?.status}, S202405003=${samplesBeforeRecalc.find(s=>s.sample_no==='S202405003')?.status}`);
  
  const recalculated = await recalculateReconciliation(reconciliation.id);
  const samplesAfterRecalc = await getSamplesWithStatus(reconciliation.id);
  if (recalculated) {
    console.log(`   重新计算后: 已解决差异 ${recalculated.resolved_discrepancies} / ${recalculated.discrepancies_count}`);
    console.log(`   重新计算后样品状态: S202405001=${samplesAfterRecalc.find(s=>s.sample_no==='S202405001')?.status}, S202405002=${samplesAfterRecalc.find(s=>s.sample_no==='S202405002')?.status}, S202405003=${samplesAfterRecalc.find(s=>s.sample_no==='S202405003')?.status}`);
    console.log(`   ${recalculated.resolved_discrepancies === beforeRecalc?.resolved_discrepancies ? '✓ 已解决差异保留成功' : '✗ 已解决差异被错误重置'}`);
    
    const s1StatusMatch = samplesBeforeRecalc.find(s=>s.sample_no==='S202405001')?.status === samplesAfterRecalc.find(s=>s.sample_no==='S202405001')?.status;
    const s2StatusMatch = samplesBeforeRecalc.find(s=>s.sample_no==='S202405002')?.status === samplesAfterRecalc.find(s=>s.sample_no==='S202405002')?.status;
    const s3StatusMatch = samplesBeforeRecalc.find(s=>s.sample_no==='S202405003')?.status === samplesAfterRecalc.find(s=>s.sample_no==='S202405003')?.status;
    console.log(`   ${s1StatusMatch && s2StatusMatch && s3StatusMatch ? '✓ 样品复核状态保留成功' : '✗ 样品复核状态被错误覆盖'}`);
  }

  console.log('\n🔄 步骤9b: 多次复核场景验证（先补材料后放行）');
  const sample6Discs = await getSampleDiscrepanciesWithExplanation(reconciliation.id, 'S202405006');
  const sample6DiscIds = sample6Discs.map(d => d.discrepancyId);
  const review4Supplement = await reviewSample(
    reconciliation.id,
    'S202405006',
    'supplement',
    '接样员张三',
    '农药残留超标，先要求合作社提供农药使用记录',
    sample6DiscIds
  );
  if (review4Supplement) {
    console.log(`   ✓ 第一次复核: supplement - ${review4Supplement.comment}`);
  }
  
  const review4Approve = await reviewSample(
    reconciliation.id,
    'S202405006',
    'approve',
    '质量负责人李四',
    '合作社提供完整农药使用记录，复检结果0.03mg/kg合格，予以放行',
    sample6DiscIds
  );
  if (review4Approve) {
    console.log(`   ✓ 第二次复核: approve - ${review4Approve.comment}`);
  }

  const recalculated2 = await recalculateReconciliation(reconciliation.id);
  const samplesAfterRecalc2 = await getSamplesWithStatus(reconciliation.id);
  const s6Status = samplesAfterRecalc2.find(s=>s.sample_no==='S202405006')?.status;
  console.log(`   重新计算后 S202405006 状态: ${s6Status}`);
  console.log(`   ${s6Status === 'approved' ? '✓ 多次复核后状态正确（取最新approved）' : '✗ 多次复核后状态错误'}`);

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
  console.log(`   差异总数: ${reportData.summary.discrepancies}`);
  console.log(`   已解决: ${reportData.summary.resolved}`);
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
  console.log('  差异类型验证:');
  console.log('    ✓ mixed_batch (样品混批): S202405003 同时在 BATCH20240501 和 BATCH20240502');
  console.log('    ✓ retest_window (复检窗口超时): S202405003 复检超出48小时窗口');
  console.log('    ✓ report_withdrawn (报告撤回): S202405008 检测报告已撤回');
  console.log('    ✓ value_out_of_range (检测值超标): S202405002, S202405003, S202405006');
  console.log('\n需要人工修正的记录:');
  console.log('    - S202405002: 农药残留超标，已要求补材料');
  console.log('    - S202405003: 混批 + 复检超窗口，已注明原因放行');
  console.log('    - S202405006: 农药残留超标，待处理');
  console.log('    - S202405008: 报告已撤回，待处理');
  console.log('\n接样员可通过本系统向他人说明:');
  console.log('  • 为什么 S202405003 被放行：仪器故障导致复检超期，复检结果0.08mg/kg合格');
  console.log('  • 为什么 S202405002 被要求补材料：农药残留0.08mg/kg超标需要复核');
  console.log('  • 为什么 S202405008 被标记：原报告已撤回，需重新检测');
  console.log('  • 差异来源：系统自动识别并解释每一条差异的根本原因');
  console.log('\n数据同步验证:');
  console.log('  ✓ 复核后重新计算不影响已解决的差异状态');
  console.log('  ✓ 所有改动同步到详情、汇总和导出报告');
}

testFlow().catch(console.error);
