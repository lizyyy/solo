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
  
  console.log('2. 导入第一批阈值调参笔记（包含离线"良好"、线上"一般"的记录）');
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
      console.log(`   当前样本数: ${importResult.eval.sampleCount}`);
      return importResult.importedNotes[0].id;
    } catch (e) {
      console.log('   导入出错:', wrapError(e));
      return null;
    }
  })();
  console.log();
  
  console.log('3. 尝试重复导入同一批次（应该报错，数量不翻倍）');
  try {
    service.importThresholdBatch(eval1.id, 'BATCH-2026-Q2-001', batch1Data, '推荐策略老唐');
    console.log('   意外：重复导入没有报错！');
  } catch (e) {
    const friendly = wrapError(e);
    console.log(`   错误提示: ${friendly.message}`);
    console.log(`   建议: ${friendly.suggestion}`);
  }
  console.log();
  
  console.log('4. 推荐策略老唐修改一条备注（改前改后都能看到）');
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
  
  console.log('5. 推进工作流第一步：补看线上实验桶');
  try {
    const workflowResult = service.advanceWorkflow(eval1.id, WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED, '推荐策略老唐');
    console.log(`   工作流推进到: ${workflowResult.eval.workflowStep}`);
    console.log(`   评测状态: ${workflowResult.eval.status}`);
    console.log(`   ${workflowResult.message}`);
    if (workflowResult.bucketDiffs.length > 0) {
      console.log('   ⚠️  发现分桶差异，停在"差一个桶"处:');
      workflowResult.bucketDiffs.forEach(d => {
        console.log(`     笔记ID: ${d.noteId.substring(0, 8)}..., 离线: ${d.offlineBucket}, 线上: ${d.onlineBucket}, 相差: ${d.diff}个桶`);
      });
      console.log('   ⚠️  状态已标记为 needs_recheck，不能自动归正常');
    }
  } catch (e) {
    console.log('   推进出错:', wrapError(e));
  }
  console.log();
  
  console.log('6. 【核心修复验证】未复核时尝试推进到实验对比更新（应该被拦截）');
  try {
    service.advanceWorkflow(eval1.id, WORKFLOW_STEP.COMPARISON_UPDATED, '推荐策略老唐');
    console.log('   ❌ BUG：未复核就能推进到实验对比更新！运营复核被绕过了！');
  } catch (e) {
    const friendly = wrapError(e);
    console.log(`   ✅ 已拦截: ${friendly.message}`);
    console.log(`   建议: ${friendly.suggestion}`);
    const evalObj = service.getEval(eval1.id);
    console.log(`   当前工作流步骤: ${evalObj.workflowStep} (停在 online_bucket_reviewed)`);
    console.log(`   当前状态: ${evalObj.status} (仍是 needs_recheck)`);
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
  
  console.log('8. 在图表上点击一条有分桶差异的记录（能回到笔记详情和线上实验桶）');
  service.addOnlineBucket({
    bucketName: '一般',
    experimentId: 'EXP-2026-05-001',
    metrics: { clickRate: 0.12, conversion: 0.03 },
    startTime: '2026-05-01',
    endTime: '2026-05-31'
  });
  try {
    const clickResult = service.clickOnChartNote(eval1.id, firstNoteId);
    console.log(`   点击笔记: ${clickResult.note.noteId.substring(0, 8)}...`);
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
  
  console.log('9. 评测运营复核分桶差异（停在差一个桶处时复核）');
  try {
    const reviewResult = service.reviewBucketDiff(eval1.id, firstNoteId, '评测运营小王', 'normal', '确认是正常波动，线上样本量较小');
    console.log(`   复核人: 评测运营小王`);
    console.log(`   判定: ${reviewResult.reviewedNote.decision === 'normal' ? '正常' : '异常'}`);
    console.log(`   复核意见: ${reviewResult.reviewedNote.comment}`);
    console.log(`   剩余待复核: ${reviewResult.remainingPendingDiffs.length} 条`);
    console.log(`   是否全部复核完成: ${reviewResult.allReviewed}`);
    const evalObj = service.getEval(eval1.id);
    console.log(`   复核后状态: ${evalObj.status} (复核只是记录意见，推进时才改状态)`);
    console.log(`   复核后工作流: ${evalObj.workflowStep} (仍停在 online_bucket_reviewed)`);
  } catch (e) {
    console.log('   复核出错:', wrapError(e));
  }
  console.log();
  
  console.log('10. 全部复核通过后推进到实验对比更新');
  try {
    const step3Result = service.advanceWorkflow(eval1.id, WORKFLOW_STEP.COMPARISON_UPDATED, '推荐策略老唐');
    console.log(`   推进成功！工作流步骤: ${step3Result.eval.workflowStep}`);
    console.log(`   评测状态: ${step3Result.eval.status} (复核通过后推进，状态变为 normal)`);
  } catch (e) {
    const friendly = wrapError(e);
    console.log(`   推进失败: ${friendly.message}`);
  }
  console.log();
  
  console.log('11. 完整状态变化链回顾');
  const evalObj = service.getEval(eval1.id);
  console.log(`   最终工作流步骤: ${evalObj.workflowStep}`);
  console.log(`   最终状态: ${evalObj.status}`);
  console.log(`   复核记录数: ${evalObj.reviewComments.length}`);
  console.log(`   笔记版本历史:`);
  const noteHistory = service.getNoteHistory(firstNoteId);
  noteHistory.history.forEach(h => {
    console.log(`     v${h.version} [${h.changeType}] ${h.updatedBy}: ${h.oldRemark ? `"${h.oldRemark}" → ` : ''}"${h.remark}"`);
  });
  console.log();
  
  console.log('12. 边界规则说明（写在代码里的规则）');
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
