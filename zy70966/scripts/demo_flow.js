const fs = require('fs');
const path = require('path');
const db = require('../src/db');
const { importQaCsv, importSummaryJson, importAppealCsv, autoMatchSummaries } = require('../src/services/importer');
const { submitAppeal, processReview, explainDifferences } = require('../src/services/appealService');
const { recalcQaItem } = require('../src/services/recalcEngine');
const { buildSummary, listDetails, exportCsv } = require('../src/services/reportService');
const { traceFromDetail, traceFromReport } = require('../src/services/traceService');

function logStep(title) {
  console.log(`\n========== ${title} ==========`);
}

function assert(cond, msg) {
  if (!cond) {
    console.error('❌ 断言失败:', msg);
    process.exit(1);
  }
  console.log('✅', msg);
}

try {
  db.prepare('DELETE FROM audit_log').run();
  db.prepare('DELETE FROM score_snapshots').run();
  db.prepare('DELETE FROM reviews').run();
  db.prepare('DELETE FROM appeals').run();
  db.prepare('DELETE FROM deductions').run();
  db.prepare('DELETE FROM call_summaries').run();
  db.prepare('DELETE FROM qa_items').run();
  db.prepare('DELETE FROM imports').run();
  db.prepare('DELETE FROM reports').run();
  console.log('🧹 数据库已清理');

  logStep('1. 导入质检 CSV');
  const qaBuf = fs.readFileSync(path.join(__dirname, '../samples/qa_sample.csv'));
  const qaR = importQaCsv(qaBuf, 'qa_sample.csv', 'demo');
  console.log('导入结果:', qaR);
  assert(qaR.count === 5, '质检导入 5 条');

  logStep('2. 导入录音摘要 JSON');
  const sBuf = fs.readFileSync(path.join(__dirname, '../samples/summaries_sample.json'));
  const sR = importSummaryJson(sBuf, 'summaries_sample.json', 'demo');
  console.log('导入结果:', sR);
  assert(sR.count === 4, '摘要导入 4 条');

  logStep('3. 自动比对质检与摘要');
  const matchR = autoMatchSummaries();
  console.log('比对结果:', JSON.stringify(matchR, null, 2));
  assert(matchR.matched_count === 4, '4 条匹配成功');

  logStep('4. 导入申诉 CSV');
  const aBuf = fs.readFileSync(path.join(__dirname, '../samples/appeals_sample.csv'));
  const aR = importAppealCsv(aBuf, 'appeals_sample.csv', 'demo');
  console.log('导入结果:', aR);
  assert(aR.count === 3, '申诉导入 3 条');

  logStep('5. 提交单条申诉');
  const call001 = db.prepare('SELECT id, score_final FROM qa_items WHERE call_id = ?').get('CALL001');
  const d001 = db.prepare('SELECT id FROM deductions WHERE qa_item_id = ? AND rule_code = ?').get(call001.id, '扣分_002');
  const appealR = submitAppeal({
    qaItemId: call001.id,
    deductionId: d001.id,
    appellant: '张三',
    reason: '已按知识库告知退款流程，解答无误'
  });
  console.log('申诉提交:', appealR);

  logStep('6. 一次复核 - 撤销扣分001');
  const appeal1 = db.prepare('SELECT * FROM appeals WHERE qa_item_id = ? AND deduction_id IS NOT NULL ORDER BY id').get(call001.id);
  const review1 = processReview({
    appealId: appeal1.id,
    reviewer: '质检主管',
    decision: 'overruled',
    comment: '录音核实，未打断用户，撤销扣分001',
    adjustmentPoints: 10,
    revokeDeduction: true
  });
  console.log('复核1结果:', review1);
  assert(review1.scoreAfter > review1.scoreBefore, '分数应上升');

  logStep('7. 二次复核 - 维持撤销');
  const review2 = processReview({
    appealId: appeal1.id,
    reviewer: '质检经理',
    decision: 'overruled',
    comment: '二次复核，维持原判',
    adjustmentPoints: 0,
    revokeDeduction: false
  });
  console.log('复核2结果:', review2);
  assert(review2.isSecondary === 1, '应为二次复核');

  logStep('8. 差异解释');
  const exp = explainDifferences(call001.id);
  console.log('差异解释:', JSON.stringify(exp, null, 2));
  assert(exp.delta !== 0, '应有分数差异');
  assert(exp.revoked_deductions.length >= 1, '至少有1个撤销扣分');

  logStep('9. 重新计算');
  const recalcR = recalcQaItem(call001.id, { sourceEvent: 'manual', reason: '手动触发重算' });
  console.log('重算结果:', recalcR);

  logStep('10. 汇总统计');
  const summary = buildSummary();
  console.log('汇总:', JSON.stringify(summary, null, 2));
  assert(summary.total_records === 4, '总记录 4 条（去重后通话数）');
  assert(summary.revised_count >= 1, '至少有1条修改');

  logStep('11. 导出 CSV 报告');
  const expR = exportCsv();
  console.log('导出结果:', expR);
  assert(fs.existsSync(expR.filePath), '报告文件已生成');
  assert(expR.rows === 4, '导出 4 行');

  logStep('12. 全链路追溯 - 从单条明细');
  const trace = traceFromDetail(call001.id);
  console.log('追溯链路节点:', Object.keys(trace));
  assert(trace.qa && trace.import && trace.summary, '核心节点齐全');
  assert(trace.audit_log.length >= 2, '至少 2 条审计记录');
  assert(trace.related_reports.length >= 1, '关联报告存在');

  logStep('13. 全链路追溯 - 从报告');
  const rTrace = traceFromReport(expR.reportId);
  console.log('报告追溯:', rTrace.report.id, rTrace.summary?.total_records);
  assert(rTrace.summary?.total_records === 4, '报告汇总正确');

  logStep('14. 验证数值联动');
  const after = db.prepare('SELECT score_final FROM qa_items WHERE id = ?').get(call001.id).score_final;
  const details = listDetails();
  const detail = details.find(d => d.id === call001.id);
  const sum = buildSummary();
  console.log(`最终分数:${after}, 详情分数:${detail.score_final}, 汇总平均:${sum.average_score}`);
  assert(after === detail.score_final, '详情与主表同步');

  console.log('\n🎉 端到端 demo 全部通过！');
  console.log('📄 报告文件:', expR.filePath);
  console.log('🗄️  数据库:', require('../src/config').dbPath);

} catch (e) {
  console.error('❌ Demo 失败:', e);
  console.error(e.stack);
  process.exit(1);
}
