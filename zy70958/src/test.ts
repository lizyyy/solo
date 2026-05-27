import * as path from 'path';
import { ReconciliationService } from './index';
import { ReviewDecision, AppealStatus } from './types';

async function main() {
  console.log('=== 后勤对账服务 - 完整流程演示 ===\n');

  const service = new ReconciliationService();

  const sampleDataDir = path.join(process.cwd(), 'sample-data');

  console.log('【步骤1】创建对账批次并导入数据');
  const importResult = await service.createBatch(
    '2024年1月对账批次',
    '后勤管理员',
    path.join(sampleDataDir, 'repairs.csv'),
    path.join(sampleDataDir, 'workers.json'),
    path.join(sampleDataDir, 'ratings.json')
  );
  console.log('导入结果:', JSON.stringify(importResult, null, 2));
  console.log();

  console.log('【步骤2】运行自动比对');
  const discrepancies = service.runMatching(importResult.batchId);
  console.log(`检测到 ${discrepancies.length} 条差异:`);
  discrepancies.forEach((d, i) => {
    console.log(`  ${i + 1}. [${d.type}] ${d.description}`);
    console.log(`     严重程度: ${d.severity}, 相关报修: ${d.repairNo || 'N/A'}`);
  });
  console.log();

  const batch = service.getSummary(importResult.batchId);
  console.log('【步骤3】查看批次统计');
  console.log(JSON.stringify(batch?.statistics, null, 2));
  console.log();

  console.log('【步骤4】人工复核差异');
  const pending = service.getPendingDiscrepancies(importResult.batchId);
  console.log(`待处理差异: ${pending.length} 条`);

  const timeoutDiscrepancies = pending.filter(d => d.type === 'timeout_penalty');
  timeoutDiscrepancies.forEach((d, i) => {
    const match = d.description.match(/建议扣 (\d+) 分/);
    const suggestedPoints = match ? parseInt(match[1]) : 0;
    const adjustment = -suggestedPoints;

    console.log(`\n处理超时差异 ${i + 1}: ${d.repairNo} (维修工: ${d.workerId})`);
    console.log('描述:', d.description);

    const review = service.reviewDiscrepancy(
      d.id,
      'approved',
      '审核员张三',
      '超时情况属实，按规则扣分',
      adjustment,
      `超时${d.evidence[d.evidence.length - 2]?.split(': ')[1] || ''}，扣${Math.abs(adjustment)}分`
    );
    console.log('审核结果: 扣', Math.abs(adjustment), '分，理由:', review.adjustmentReason);
  });

  const otherDiscrepancies = pending.filter(d => d.type !== 'timeout_penalty');
  otherDiscrepancies.forEach((d, i) => {
    if (i === 0) {
      console.log(`\n处理差异 ${d.id} (${d.type}):`);
      const review = service.reviewDiscrepancy(
        d.id,
        'approved',
        '审核员张三',
        '情况属实，合并处理',
        0,
        '重复报修合并处理，不单独扣分'
      );
      console.log('审核结果:', JSON.stringify(review, null, 2));
    } else if (i === 1) {
      console.log(`\n处理差异 ${d.id} (${d.type}):`);
      const review2 = service.reviewDiscrepancy(
        d.id,
        'rejected',
        '审核员张三',
        '经核实不属于恶意评分，学生确有不满'
      );
      console.log('审核结果:', JSON.stringify(review2, null, 2));
    }
  });
  console.log();

  console.log('【步骤5】评分申诉流程');
  const discrepanciesAll = service.getDiscrepancies();
  const maliciousDiscrepancies = discrepanciesAll.filter(d => d.type === 'malicious_rating');
  if (maliciousDiscrepancies.length > 0 && maliciousDiscrepancies[0].ratingId) {
    const ratingId = maliciousDiscrepancies[0].ratingId;
    console.log(`维修工对评分 ${ratingId} 提出申诉:`);

    const appeal = service.submitAppeal(
      ratingId,
      '陈师傅',
      'worker',
      '维修过程遇到特殊情况，配件缺货导致延迟，非个人原因',
      ['配件缺货证明照片', '与学生沟通记录截图']
    );
    console.log('申诉提交:', JSON.stringify(appeal, null, 2));

    console.log('\n查看申诉追踪轨迹:');
    const trail = service.getAppealTrail(ratingId);
    trail.forEach(t => {
      console.log(`  [${t.timestamp}] ${t.actor} - ${t.action}`);
      if (t.score !== undefined) console.log(`    评分: ${t.score}`);
      if (t.comment) console.log(`    说明: ${t.comment}`);
    });

    console.log('\n管理员审核申诉:');
    const appealReview = service.reviewAppeal(
      appeal.id,
      '管理员李四',
      'upheld',
      '情况属实，配件缺货为不可抗力因素，调整评分',
      80
    );
    console.log('申诉审核结果:', JSON.stringify(appealReview, null, 2));

    console.log('\n申诉后的完整轨迹:');
    const trailAfter = service.getAppealTrail(ratingId);
    trailAfter.forEach(t => {
      console.log(`  [${t.timestamp}] ${t.actor} - ${t.action}`);
      if (t.score !== undefined) console.log(`    评分: ${t.score}`);
      if (t.comment) console.log(`    说明: ${t.comment}`);
    });
  }
  console.log();

  console.log('【步骤6】差异解释说明（用于对外沟通）');
  const allDiscrepancies = service.getDiscrepancies();
  if (allDiscrepancies.length > 0) {
    const explanation = service.getDiscrepancyExplanation(allDiscrepancies[0].id);
    console.log('差异详情:');
    console.log('  类型:', explanation.discrepancy.type);
    console.log('  描述:', explanation.discrepancy.description);
    console.log('  证据:', explanation.discrepancy.evidence);
    console.log('  处理结果:', explanation.impact);
    if (explanation.reviews.length > 0) {
      console.log('  审核记录:');
      explanation.reviews.forEach(r => {
        console.log(`    ${r.reviewer} at ${r.reviewedAt}: ${r.decision} - ${r.comment}`);
      });
    }
  }
  console.log();

  console.log('【步骤7】重新计算并生成报告');
  const reportFiles = service.recalculateAndReport(importResult.batchId);
  console.log('报告生成完成:');
  console.log('  汇总报告:', reportFiles.summary);
  console.log('  详细报告:');
  reportFiles.details.forEach((f: string) => console.log('    -', f));
  console.log();

  console.log('【步骤8】查看最终批次状态');
  const finalBatch = service.getSummary(importResult.batchId);
  console.log('批次状态:', finalBatch?.status);
  console.log('最终统计:', JSON.stringify(finalBatch?.statistics, null, 2));

  console.log('\n=== 演示完成 ===');
}

main().catch(console.error);
