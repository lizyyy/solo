const EvalService = require('./services/EvalService');
const { WORKFLOW_STEP, DISPLAY_MODE } = require('./models/types');
const { wrapError } = require('./utils/errors');
const { getBoundaryRulesSummary } = require('./boundaryRules');

function runDemo() {
  console.log('===== 小样本 few-shot 评测系统 Demo =====\n');
  
  const service = new EvalService();
  
  console.log('1. 创建新的小样本评测');
  const eval1 = service.createEval('2026年Q2推荐策略评测', '推荐策略老唐');
  console.log(`   创建成功，评测ID: ${eval1.id}`);
  console.log(`   当前状态: ${eval1.status}`);
  console.log(`   当前工作流步骤: ${eval1.workflowStep}`);
  console.log();
  
  console.log('2. 导入第一批阈值调参笔记（包含一个桶差异的记录）');
  const batch1Data = [
    {
      thresholds: { click: 0.5, view: 0.3 },
      remark: '初始阈值配置A',
      offlineScore: 85,
      onlineScore: 82,
      offlineBucket: '良好',
      onlineBucket: '一般'
    },
    {
      thresholds: { click: 0.6, view: 0.4 },
      remark: '初始阈值配置B',
      offlineScore: 90,
      onlineScore: 91,
      offlineBucket: '优秀',
      onlineBucket: '优秀'
    },
    {
      thresholds: { click: 0.4, view: 0.2 },
      remark: '初始阈值配置C',
      offlineScore: 75,
      onlineScore: 70,
      offlineBucket: '一般',
      onlineBucket: '较差'
    }
  ];
  
  try {
    const importResult = service.importThresholdBatch(eval1.id, 'BATCH-2026-Q2-001', batch1Data, '推荐策略老唐');
    console.log(`   导入成功，批次号: ${importResult.batchId}`);
    console.log(`   导入笔记数量: ${importResult.count}`);
    console.log(`   当前样本数: ${importResult.eval.sampleCount}`);
  } catch (e) {
    console.log('   导入出错:', wrapError(e));
  }
  console.log();
  
  console.log('3. 尝试重复导入同一批次（应该报错）');
  try {
    service.importThresholdBatch(eval1.id, 'BATCH-2026-Q2-001', batch1Data, '推荐策略老唐');
    console.log('   意外：重复导入没有报错！');
  } catch (e) {
    const friendly = wrapError(e);
    console.log(`   错误提示: ${friendly.message}`);
    console.log(`   建议: ${friendly.suggestion}`);
  }
  console.log();
  
  console.log('4. 推荐策略老唐修改一条备注');
  const firstNoteId = eval1.thresholdNoteIds[0];
  try {
    const updateResult = service.updateNoteRemark(firstNoteId, 'A方案需要再观察一下线上数据', '推荐策略老唐');
    console.log(`   修改成功，版本号: ${updateResult.version}`);
    console.log(`   改前备注: ${updateResult.oldRemark}`);
    console.log(`   改后备注: ${updateResult.newRemark}`);
    console.log('   历史记录:');
    updateResult.history.forEach(h => {
      console.log(`     v${h.version} [${h.changeType}] ${h.updatedBy || '系统'}: ${h.oldRemark ? `${h.oldRemark} → ` : ''}${h.remark}`);
    });
  } catch (e) {
    console.log('   修改出错:', wrapError(e));
  }
  console.log();
  
  console.log('5. 添加线上实验桶');
  const bucket1 = service.addOnlineBucket({
    bucketName: '一般',
    experimentId: 'EXP-2026-05-001',
    metrics: { clickRate: 0.12, conversion: 0.03 },
    startTime: '2026-05-01',
    endTime: '2026-05-31'
  });
  console.log(`   添加成功，桶: ${bucket1.bucketName}, 实验ID: ${bucket1.experimentId}`);
  console.log();
  
  console.log('6. 推进工作流：补看线上实验桶');
  try {
    const workflowResult = service.advanceWorkflow(eval1.id, WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED, '推荐策略老唐');
    console.log(`   工作流推进到: ${workflowResult.eval.workflowStep}`);
    console.log(`   评测状态: ${workflowResult.eval.status}`);
    console.log(`   ${workflowResult.message}`);
    if (workflowResult.bucketDiffs.length > 0) {
      console.log('   待复核的分桶差异记录:');
      workflowResult.bucketDiffs.forEach(d => {
        console.log(`     笔记ID: ${d.noteId}, 离线: ${d.offlineBucket}, 线上: ${d.onlineBucket}, 相差: ${d.diff}个桶`);
      });
    }
  } catch (e) {
    console.log('   推进出错:', wrapError(e));
  }
  console.log();
  
  console.log('7. 设置展示模式为图表');
  try {
    service.setDisplayMode(eval1.id, DISPLAY_MODE.CHART);
    console.log('   设置成功，展示模式: chart');
  } catch (e) {
    console.log('   设置出错:', wrapError(e));
  }
  console.log();
  
  console.log('8. 在图表上点击一条有分桶差异的记录，验证能跳转到详情');
  try {
    const diffNoteId = eval1.thresholdNoteIds[0];
    const clickResult = service.clickOnChartNote(eval1.id, diffNoteId);
    console.log(`   点击笔记: ${clickResult.note.noteId}`);
    console.log(`   离线分桶: ${clickResult.note.offlineBucket}, 线上分桶: ${clickResult.note.onlineBucket}`);
    console.log(`   关联的线上实验桶: ${clickResult.linkedBucket ? clickResult.linkedBucket.experimentId : '未找到'}`);
    console.log(`   触发的边界规则:`);
    clickResult.boundaryRules.forEach(r => {
      console.log(`     - ${r.ruleName}: ${r.judgment}`);
      console.log(`       处理人: ${r.handling.who}`);
    });
  } catch (e) {
    console.log('   点击出错:', wrapError(e));
  }
  console.log();
  
  console.log('9. 评测运营复核分桶差异');
  try {
    const diffNoteId = eval1.thresholdNoteIds[0];
    const reviewResult = service.reviewBucketDiff(eval1.id, diffNoteId, '评测运营小王', 'normal', '确认是正常波动，线上样本量较小');
    console.log(`   复核人: ${reviewResult.reviewedNote.decision === 'normal' ? '判定为正常' : '判定为异常'}`);
    console.log(`   复核意见: ${reviewResult.reviewedNote.comment}`);
    console.log(`   剩余待复核: ${reviewResult.remainingPendingDiffs.length} 条`);
    console.log(`   是否全部复核完成: ${reviewResult.allReviewed}`);
  } catch (e) {
    console.log('   复核出错:', wrapError(e));
  }
  console.log();
  
  console.log('10. 边界规则说明（写在代码里的规则）');
  const rules = getBoundaryRulesSummary();
  rules.forEach(rule => {
    console.log(`   [${rule.id}] ${rule.name}`);
    console.log(`     说明: ${rule.description}`);
    console.log(`     判定: ${rule.judgment}`);
    console.log(`     处理人: ${rule.handler}`);
    console.log();
  });
  
  console.log('===== Demo 结束 =====');
}

if (require.main === module) {
  runDemo();
}

module.exports = {
  EvalService,
  runDemo,
  getBoundaryRulesSummary
};
