const EvalService = require('./services/EvalService');
const { WORKFLOW_STEP, EVAL_STATUS, DISPLAY_MODE } = require('./models/types');
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

  console.log('2. 导入阈值调参笔记（离线"良好"、线上"一般"，差一个桶）');
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
    }
  ];

  const firstNoteId = (() => {
    try {
      const importResult = service.importThresholdBatch(eval1.id, 'BATCH-2026-Q2-001', batch1Data, '推荐策略老唐');
      console.log(`   导入成功，批次号: ${importResult.batchId}`);
      console.log(`   导入笔记数量: ${importResult.count}`);
      return importResult.importedNotes[0].id;
    } catch (e) {
      console.log('   导入出错:', wrapError(e));
      return null;
    }
  })();
  console.log();

  console.log('3. 推荐策略老唐补录备注（改前改后都能看到）');
  try {
    const updateResult = service.updateNoteRemark(firstNoteId, 'A方案需要再观察线上数据', '推荐策略老唐');
    console.log(`   改前备注: ${updateResult.oldRemark}`);
    console.log(`   改后备注: ${updateResult.newRemark}`);
  } catch (e) {
    console.log('   修改出错:', wrapError(e));
  }
  console.log();

  console.log('4. 推进工作流到补看线上实验桶');
  try {
    const workflowResult = service.advanceWorkflow(eval1.id, WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED, '推荐策略老唐');
    console.log(`   工作流步骤: ${workflowResult.eval.workflowStep}`);
    console.log(`   评测状态: ${workflowResult.eval.status}`);
    if (workflowResult.bucketDiffs.length > 0) {
      console.log(`   ${workflowResult.message}`);
      console.log('   停在差一个桶处，不能自动归正常');
    }
  } catch (e) {
    console.log('   推进出错:', wrapError(e));
  }
  console.log();

  console.log('5. 【验证1】未复核时尝试推进到实验对比更新（应该被拦截）');
  try {
    service.advanceWorkflow(eval1.id, WORKFLOW_STEP.COMPARISON_UPDATED, '推荐策略老唐');
    console.log('   BUG：未复核就能推进！');
  } catch (e) {
    const friendly = wrapError(e);
    console.log(`   已拦截: ${friendly.message}`);
  }
  console.log();

  console.log('6. 【验证2】评测运营判定异常（数据不一致需重新导入）');
  try {
    const reviewResult = service.reviewBucketDiff(eval1.id, firstNoteId, '评测运营小王', 'abnormal', '数据不一致需重新导入');
    console.log(`   判定: 异常`);
    console.log(`   自动回滚: ${reviewResult.autoRollback}`);
    console.log(`   状态: ${reviewResult.status}`);
    console.log(`   工作流步骤: ${reviewResult.workflowStep}`);
    console.log(`   rollbackHistory 记录数: ${service.getEval(eval1.id).rollbackHistory.length}`);
    console.log(`   回滚原因: ${reviewResult.rollbackRecord.reason}`);
  } catch (e) {
    console.log('   复核出错:', wrapError(e));
  }
  console.log();

  console.log('7. 【验证3】异常复核后尝试推进（应该被拦截）');
  const evalObj = service.getEval(eval1.id);
  try {
    service.advanceWorkflow(eval1.id, WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED, '推荐策略老唐');
    console.log('   BUG：异常复核后还能推进！');
  } catch (e) {
    const friendly = wrapError(e);
    console.log(`   已拦截: ${friendly.message}`);
    console.log(`   建议: ${friendly.suggestion}`);
  }
  console.log(`   当前状态: ${evalObj.status} (停在 abnormal)`);
  console.log(`   当前工作流: ${evalObj.workflowStep} (停在 imported)`);
  console.log(`   rollbackHistory: ${evalObj.rollbackHistory.length} 条`);
  console.log();

  console.log('8. 【验证4】异常复核后状态、待复核清单、结果说明核对');
  const pending = evalObj.checkBucketDiffsAfterReview();
  console.log(`   状态: ${evalObj.status} (不是 normal)`);
  console.log(`   工作流: ${evalObj.workflowStep}`);
  console.log(`   待复核清单: ${pending.length} 条 (异常记录仍在待复核中，因为未正常通过)`);
  console.log(`   rollbackHistory: ${evalObj.rollbackHistory.length} 条`);
  console.log(`   是否被归为 normal: ${evalObj.status === EVAL_STATUS.NORMAL ? '是(BUG!)' : '否(正确)'}`);
  console.log();

  console.log('===== 异常复核场景验证完毕 =====');
  console.log();

  console.log('===== 正常复核场景 =====');

  const service2 = new EvalService();
  const eval2 = service2.createEval('正常复核测试', '推荐策略老唐');
  const normalNoteId = (() => {
    const r = service2.importThresholdBatch(eval2.id, 'BATCH-NORMAL', [
      { thresholds: { click: 0.5 }, remark: '配置', offlineBucket: '良好', onlineBucket: '一般' }
    ], '推荐策略老唐');
    return r.importedNotes[0].id;
  })();

  service2.advanceWorkflow(eval2.id, WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED, '推荐策略老唐');
  service2.reviewBucketDiff(eval2.id, normalNoteId, '评测运营小王', 'normal', '确认正常波动');
  const step3 = service2.advanceWorkflow(eval2.id, WORKFLOW_STEP.COMPARISON_UPDATED, '推荐策略老唐');

  console.log(`   正常复核后状态: ${step3.eval.status}`);
  console.log(`   正常复核后工作流: ${step3.eval.workflowStep}`);
  console.log();

  console.log('===== 边界规则说明 =====');
  const rules = getBoundaryRulesSummary();
  rules.forEach(rule => {
    console.log(`   [${rule.id}] ${rule.name}`);
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
