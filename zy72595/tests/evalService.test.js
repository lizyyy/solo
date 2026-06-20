const EvalService = require('../src/services/EvalService');
const { WORKFLOW_STEP, EVAL_STATUS, DISPLAY_MODE } = require('../src/models/types');
const { FriendlyError, wrapError } = require('../src/utils/errors');
const { checkBoundaryRules, BOUNDARY_RULES } = require('../src/boundaryRules');

describe('小样本 few-shot 评测系统', () => {
  let service;
  let evalId;
  let noteIds;

  beforeEach(() => {
    service = new EvalService();
    const evalObj = service.createEval('测试评测', '推荐策略老唐');
    evalId = evalObj.id;
    const batchData = [
      {
        thresholds: { click: 0.5 },
        remark: '配置A',
        offlineScore: 85,
        onlineScore: 82,
        offlineBucket: '良好',
        onlineBucket: '一般'
      },
      {
        thresholds: { click: 0.6 },
        remark: '配置B',
        offlineScore: 90,
        onlineScore: 90,
        offlineBucket: '优秀',
        onlineBucket: '优秀'
      }
    ];

    const result = service.importThresholdBatch(evalId, 'BATCH-TEST-001', batchData, '推荐策略老唐');
    noteIds = result.importedNotes.map(n => n.id);
  });

  describe('1. 边界规则', () => {
    test('差一个桶触发 ONE_BUCKET_DIFF 规则', () => {
      const note = { offlineBucket: '良好', onlineBucket: '一般' };
      const rules = checkBoundaryRules(note);
      expect(rules.some(r => r.ruleId === 'ONE_BUCKET_DIFF')).toBe(true);
      expect(rules[0].autoMarkNormal).toBe(false);
    });

    test('分桶一致触发 SAME_BUCKET 规则，可自动归正常', () => {
      const note = { offlineBucket: '优秀', onlineBucket: '优秀' };
      const rules = checkBoundaryRules(note);
      expect(rules.some(r => r.ruleId === 'SAME_BUCKET')).toBe(true);
      expect(rules.find(r => r.ruleId === 'SAME_BUCKET').autoMarkNormal).toBe(true);
    });

    test('差两个桶触发 MORE_THAN_ONE_BUCKET_DIFF 规则', () => {
      const note = { offlineBucket: '优秀', onlineBucket: '一般' };
      const rules = checkBoundaryRules(note);
      expect(rules.some(r => r.ruleId === 'MORE_THAN_ONE_BUCKET_DIFF')).toBe(true);
    });

    test('差一个桶的规则明确写了需要人工复核', () => {
      const rule = BOUNDARY_RULES.ONE_BUCKET_DIFF;
      expect(rule.autoMarkNormal).toBe(false);
      expect(rule.handling.who).toBe('评测运营');
      expect(rule.judgment).toContain('人工复核');
    });
  });

  describe('2. 重复导入防翻倍', () => {
    test('同一批次不能重复导入', () => {
      const batchData = [{ thresholds: {}, remark: '测试', offlineBucket: '一般', onlineBucket: '一般' }];

      expect(() => {
        service.importThresholdBatch(evalId, 'BATCH-TEST-001', batchData, '推荐策略老唐');
      }).toThrow(FriendlyError);

      const evalObj = service.getEval(evalId);
      expect(evalObj.sampleCount).toBe(2);
    });

    test('重复导入提示人话错误', () => {
      const batchData = [{ thresholds: {}, remark: '测试', offlineBucket: '一般', onlineBucket: '一般' }];

      try {
        service.importThresholdBatch(evalId, 'BATCH-TEST-001', batchData, '推荐策略老唐');
      } catch (e) {
        const friendly = wrapError(e);
        expect(friendly.message).toContain('已经导入过了');
        expect(friendly.suggestion).toBeTruthy();
        expect(friendly.code).toBe('BATCH_ALREADY_IMPORTED');
      }
    });

    test('不同批次可以正常导入，样本数增加', () => {
      const batchData = [{ thresholds: {}, remark: '测试', offlineBucket: '一般', onlineBucket: '一般' }];
      const result = service.importThresholdBatch(evalId, 'BATCH-TEST-002', batchData, '推荐策略老唐');

      expect(result.count).toBe(1);
      expect(result.eval.sampleCount).toBe(3);
    });
  });

  describe('3. 版本历史追踪', () => {
    test('修改备注能看出改前改后', () => {
      const noteId = noteIds[0];
      const result = service.updateNoteRemark(noteId, '修改后的备注', '推荐策略老唐');

      expect(result.oldRemark).toBe('配置A');
      expect(result.newRemark).toBe('修改后的备注');
      expect(result.version).toBe(2);
    });

    test('历史记录包含改前改后值', () => {
      const noteId = noteIds[0];
      service.updateNoteRemark(noteId, '第一次修改', '推荐策略老唐');
      service.updateNoteRemark(noteId, '第二次修改', '推荐策略老唐');

      const history = service.getNoteHistory(noteId);
      expect(history.history.length).toBe(3);
      expect(history.history[1].oldRemark).toBe('配置A');
      expect(history.history[1].remark).toBe('第一次修改');
      expect(history.history[2].oldRemark).toBe('第一次修改');
      expect(history.history[2].remark).toBe('第二次修改');
    });

    test('备注没变会报错', () => {
      const noteId = noteIds[0];
      expect(() => {
        service.updateNoteRemark(noteId, '配置A', '推荐策略老唐');
      }).toThrow(FriendlyError);
    });
  });

  describe('4. 三步工作流', () => {
    test('推进到补看线上实验桶时，检测到差一个桶标记为待复核', () => {
      const result = service.advanceWorkflow(evalId, WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED, '推荐策略老唐');

      expect(result.eval.workflowStep).toBe(WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED);
      expect(result.eval.status).toBe(EVAL_STATUS.NEEDS_RECHECK);
      expect(result.bucketDiffs.length).toBeGreaterThan(0);
      expect(result.needsReview).toBe(true);
    });

    test('差一个桶的记录不会自动归正常，留给评测运营', () => {
      service.advanceWorkflow(evalId, WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED, '推荐策略老唐');
      const evalObj = service.getEval(evalId);

      expect(evalObj.status).toBe(EVAL_STATUS.NEEDS_RECHECK);
      expect(evalObj.checkBucketDiffsAfterReview().length).toBeGreaterThan(0);
    });

    test('评测运营正常复核后记录意见，状态仍为 NEEDS_RECHECK 直到推进', () => {
      service.advanceWorkflow(evalId, WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED, '推荐策略老唐');

      service.reviewBucketDiff(evalId, noteIds[0], '评测运营小王', 'normal', '确认正常');

      const evalObj = service.getEval(evalId);
      expect(evalObj.status).toBe(EVAL_STATUS.NEEDS_RECHECK);
    });

    test('不能跳过步骤推进', () => {
      expect(() => {
        service.advanceWorkflow(evalId, WORKFLOW_STEP.COMPARISON_UPDATED, '推荐策略老唐');
      }).toThrow(FriendlyError);
    });
  });

  describe('5. 3D/图表展示点击跳转', () => {
    test('点击图表记录能回到阈值调参笔记', () => {
      service.setDisplayMode(evalId, DISPLAY_MODE.CHART);

      const result = service.clickOnChartNote(evalId, noteIds[0]);

      expect(result.note.noteId).toBe(noteIds[0]);
      expect(result.note.offlineBucket).toBe('良好');
      expect(result.note.onlineBucket).toBe('一般');
      expect(result.boundaryRules.length).toBeGreaterThan(0);
    });

    test('点击记录能看到关联的线上实验桶', () => {
      service.addOnlineBucket({
        bucketName: '一般',
        experimentId: 'EXP-TEST-001',
        metrics: { clickRate: 0.1 }
      });

      const result = service.clickOnChartNote(evalId, noteIds[0]);

      expect(result.linkedBucket).not.toBeNull();
      expect(result.linkedBucket.experimentId).toBe('EXP-TEST-001');
    });

    test('支持切换到3D模式', () => {
      const evalObj = service.setDisplayMode(evalId, DISPLAY_MODE.THREE_D);
      expect(evalObj.displayMode).toBe('3d');
    });
  });

  describe('6. 友好错误提示', () => {
    test('找不到评测返回人话错误', () => {
      try {
        service.getEval('non-existent-id');
      } catch (e) {
        const friendly = wrapError(e);
        expect(friendly.message).toContain('找不到');
        expect(friendly.suggestion).toContain('检查评测ID');
      }
    });

    test('无效的桶名称返回人话错误', () => {
      const batchData = [{ thresholds: {}, remark: '测试', offlineBucket: '超级好', onlineBucket: '一般' }];

      try {
        service.importThresholdBatch(evalId, 'BATCH-TEST-003', batchData, '推荐策略老唐');
      } catch (e) {
        const friendly = wrapError(e);
        expect(friendly.message).toContain('桶名称不正确');
        expect(friendly.suggestion).toContain('差、较差、一般、良好、优秀');
      }
    });
  });

  describe('7. 回滚功能', () => {
    test('支持回滚到之前的步骤', () => {
      service.advanceWorkflow(evalId, WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED, '推荐策略老唐');

      const result = service.rollbackWorkflow(evalId, WORKFLOW_STEP.IMPORTED, '推荐策略老唐', '数据有误');

      expect(result.eval.workflowStep).toBe(WORKFLOW_STEP.IMPORTED);
      expect(result.eval.status).toBe(EVAL_STATUS.ROLLBACK);
      expect(result.rollbackRecord.reason).toBe('数据有误');
    });
  });

  describe('8. 未复核时不能推进到实验对比更新', () => {
    test('未复核差一个桶记录时，推进到 COMPARISON_UPDATED 被拦截', () => {
      service.advanceWorkflow(evalId, WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED, '推荐策略老唐');

      expect(() => {
        service.advanceWorkflow(evalId, WORKFLOW_STEP.COMPARISON_UPDATED, '推荐策略老唐');
      }).toThrow(FriendlyError);
    });

    test('全部正常复核后才能推进到 COMPARISON_UPDATED', () => {
      service.advanceWorkflow(evalId, WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED, '推荐策略老唐');
      service.reviewBucketDiff(evalId, noteIds[0], '评测运营小王', 'normal', '正常波动');

      const result = service.advanceWorkflow(evalId, WORKFLOW_STEP.COMPARISON_UPDATED, '推荐策略老唐');
      expect(result.eval.workflowStep).toBe(WORKFLOW_STEP.COMPARISON_UPDATED);
      expect(result.eval.status).toBe(EVAL_STATUS.NORMAL);
    });

    test('部分复核仍不能推进', () => {
      const batchData = [
        { thresholds: { click: 0.3 }, remark: '配置C', offlineBucket: '优秀', onlineBucket: '良好' }
      ];
      service.importThresholdBatch(evalId, 'BATCH-TEST-002', batchData, '推荐策略老唐');
      service.advanceWorkflow(evalId, WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED, '推荐策略老唐');

      service.reviewBucketDiff(evalId, noteIds[0], '评测运营小王', 'normal', '正常');

      expect(() => {
        service.advanceWorkflow(evalId, WORKFLOW_STEP.COMPARISON_UPDATED, '推荐策略老唐');
      }).toThrow(FriendlyError);
    });
  });

  describe('9. 异常复核全链路：离线良好/线上一般 → 判定异常', () => {
    let evalObj;

    beforeEach(() => {
      service.advanceWorkflow(evalId, WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED, '推荐策略老唐');
      evalObj = service.getEval(evalId);
    });

    test('异常复核后状态变为 abnormal', () => {
      const result = service.reviewBucketDiff(evalId, noteIds[0], '评测运营小王', 'abnormal', '数据不一致需重新导入');

      expect(result.autoRollback).toBe(true);
      expect(evalObj.status).toBe(EVAL_STATUS.ABNORMAL);
    });

    test('异常复核后工作流自动回滚到 imported', () => {
      service.reviewBucketDiff(evalId, noteIds[0], '评测运营小王', 'abnormal', '数据不一致需重新导入');

      expect(evalObj.workflowStep).toBe(WORKFLOW_STEP.IMPORTED);
    });

    test('异常复核后 rollbackHistory 有记录', () => {
      service.reviewBucketDiff(evalId, noteIds[0], '评测运营小王', 'abnormal', '数据不一致需重新导入');

      expect(evalObj.rollbackHistory.length).toBe(1);
      expect(evalObj.rollbackHistory[0].fromStep).toBe(WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED);
      expect(evalObj.rollbackHistory[0].toStep).toBe(WORKFLOW_STEP.IMPORTED);
      expect(evalObj.rollbackHistory[0].reason).toContain('异常');
      expect(evalObj.rollbackHistory[0].triggerNoteId).toBe(noteIds[0]);
      expect(evalObj.rollbackHistory[0].triggerDecision).toBe('abnormal');
    });

    test('异常复核后该条记录仍在待复核清单中（未正常通过）', () => {
      service.reviewBucketDiff(evalId, noteIds[0], '评测运营小王', 'abnormal', '数据不一致');

      const pending = evalObj.checkBucketDiffsAfterReview();
      expect(pending.length).toBe(1);
      expect(pending[0].noteId).toBe(noteIds[0]);
      expect(pending[0].offlineBucket).toBe('良好');
      expect(pending[0].onlineBucket).toBe('一般');
    });

    test('异常复核后尝试推进到 ONLINE_BUCKET_REVIEWED 被拦截', () => {
      service.reviewBucketDiff(evalId, noteIds[0], '评测运营小王', 'abnormal', '数据异常');

      expect(() => {
        service.advanceWorkflow(evalId, WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED, '推荐策略老唐');
      }).toThrow(FriendlyError);

      try {
        service.advanceWorkflow(evalId, WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED, '推荐策略老唐');
      } catch (e) {
        const friendly = wrapError(e);
        expect(friendly.code).toBe('ABNORMAL_REVIEW_BLOCKED');
        expect(friendly.message).toContain('异常');
        expect(friendly.suggestion).toContain('重新导入');
      }
    });

    test('异常复核后尝试推进到 COMPARISON_UPDATED 被拦截', () => {
      service.reviewBucketDiff(evalId, noteIds[0], '评测运营小王', 'abnormal', '数据异常');

      expect(() => {
        service.advanceWorkflow(evalId, WORKFLOW_STEP.COMPARISON_UPDATED, '推荐策略老唐');
      }).toThrow(FriendlyError);
    });

    test('异常复核后状态不会变成 normal', () => {
      service.reviewBucketDiff(evalId, noteIds[0], '评测运营小王', 'abnormal', '数据异常');

      expect(evalObj.status).toBe(EVAL_STATUS.ABNORMAL);
      expect(evalObj.status).not.toBe(EVAL_STATUS.NORMAL);
    });

    test('异常复核后工作流步骤停在 imported', () => {
      service.reviewBucketDiff(evalId, noteIds[0], '评测运营小王', 'abnormal', '数据异常');

      expect(evalObj.workflowStep).toBe(WORKFLOW_STEP.IMPORTED);
    });

    test('异常复核后结果说明不含 normal', () => {
      const result = service.reviewBucketDiff(evalId, noteIds[0], '评测运营小王', 'abnormal', '数据不一致需重新导入');

      expect(result.status).toBe(EVAL_STATUS.ABNORMAL);
      expect(result.autoRollback).toBe(true);
      expect(result.rollbackRecord).toBeTruthy();
      expect(result.rollbackRecord.triggerDecision).toBe('abnormal');
    });
  });

  describe('10. 异常复核完整状态链：导入→备注→复核异常→尝试推进→核对', () => {
    test('用同一条差一个桶记录走完异常复核全流程', () => {
      const stateChain = [];

      const evalObj = service.getEval(evalId);
      stateChain.push({
        step: 'imported',
        workflowStep: evalObj.workflowStep,
        status: evalObj.status
      });

      const remarkResult = service.updateNoteRemark(noteIds[0], '需要再看线上数据', '推荐策略老唐');
      stateChain.push({
        step: 'remark_updated',
        noteVersion: remarkResult.version,
        oldRemark: remarkResult.oldRemark,
        newRemark: remarkResult.newRemark
      });

      service.advanceWorkflow(evalId, WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED, '推荐策略老唐');
      stateChain.push({
        step: 'online_bucket_reviewed',
        workflowStep: evalObj.workflowStep,
        status: evalObj.status,
        pendingDiffs: evalObj.checkBucketDiffsAfterReview().length
      });

      const reviewResult = service.reviewBucketDiff(evalId, noteIds[0], '评测运营小王', 'abnormal', '数据不一致需重新导入');
      stateChain.push({
        step: 'abnormal_reviewed',
        status: evalObj.status,
        workflowStep: evalObj.workflowStep,
        autoRollback: reviewResult.autoRollback,
        rollbackHistoryCount: evalObj.rollbackHistory.length
      });

      try {
        service.advanceWorkflow(evalId, WORKFLOW_STEP.COMPARISON_UPDATED, '推荐策略老唐');
      } catch (e) {}
      stateChain.push({
        step: 'advance_blocked',
        status: evalObj.status,
        workflowStep: evalObj.workflowStep,
        rollbackHistoryCount: evalObj.rollbackHistory.length
      });

      try {
        service.advanceWorkflow(evalId, WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED, '推荐策略老唐');
      } catch (e) {}
      stateChain.push({
        step: 're_advance_blocked',
        status: evalObj.status,
        workflowStep: evalObj.workflowStep
      });

      expect(stateChain[0]).toEqual({
        step: 'imported',
        workflowStep: 'imported',
        status: 'pending_review'
      });

      expect(stateChain[1]).toEqual({
        step: 'remark_updated',
        noteVersion: 2,
        oldRemark: '配置A',
        newRemark: '需要再看线上数据'
      });

      expect(stateChain[2]).toEqual({
        step: 'online_bucket_reviewed',
        workflowStep: 'online_bucket_reviewed',
        status: 'needs_recheck',
        pendingDiffs: 1
      });

      expect(stateChain[3]).toEqual({
        step: 'abnormal_reviewed',
        status: 'abnormal',
        workflowStep: 'imported',
        autoRollback: true,
        rollbackHistoryCount: 1
      });

      expect(stateChain[4].step).toBe('advance_blocked');
      expect(stateChain[4].status).toBe('abnormal');
      expect(stateChain[4].workflowStep).toBe('imported');
      expect(stateChain[4].rollbackHistoryCount).toBe(1);

      expect(stateChain[5].step).toBe('re_advance_blocked');
      expect(stateChain[5].status).toBe('abnormal');
      expect(stateChain[5].workflowStep).toBe('imported');
    });
  });

  describe('11. 无差一个桶时工作流自动标记 NORMAL', () => {
    test('所有笔记分桶一致时，推进到 ONLINE_BUCKET_REVIEWED 后状态为 normal', () => {
      const cleanService = new EvalService();
      const cleanEval = cleanService.createEval('全部一致测试', '推荐策略老唐');

      cleanService.importThresholdBatch(cleanEval.id, 'BATCH-CLEAN', [
        { thresholds: {}, remark: '测试', offlineBucket: '优秀', onlineBucket: '优秀' }
      ], '推荐策略老唐');

      const result = cleanService.advanceWorkflow(cleanEval.id, WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED, '推荐策略老唐');
      expect(result.eval.status).toBe(EVAL_STATUS.NORMAL);
      expect(result.needsReview).toBe(false);
    });
  });
});
