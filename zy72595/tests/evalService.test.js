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

    test('评测运营复核后状态变更', () => {
      service.advanceWorkflow(evalId, WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED, '推荐策略老唐');
      
      const result = service.reviewBucketDiff(evalId, noteIds[0], '评测运营小王', 'normal', '确认正常');
      
      expect(result.reviewedNote.decision).toBe('normal');
      expect(result.allReviewed).toBe(true);
      
      const evalObj = service.getEval(evalId);
      expect(evalObj.status).toBe(EVAL_STATUS.NORMAL);
    });

    test('不能跳过步骤推进', () => {
      expect(() => {
        service.advanceWorkflow(evalId, WORKFLOW_STEP.COMPARISON_UPDATED, '推荐策略老唐');
      }).toThrow(FriendlyError);
      
      try {
        service.advanceWorkflow(evalId, WORKFLOW_STEP.COMPARISON_UPDATED, '推荐策略老唐');
      } catch (e) {
        const friendly = wrapError(e);
        expect(friendly.message).toContain('顺序不对');
      }
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

  describe('8. 完整三步工作流场景', () => {
    test('走完导入→补看线上实验桶→实验对比更新，差一个桶留待复核', () => {
      service.addOnlineBucket({ bucketName: '一般', experimentId: 'EXP-001' });
      service.addOnlineBucket({ bucketName: '优秀', experimentId: 'EXP-002' });
      
      expect(service.getEval(evalId).workflowStep).toBe(WORKFLOW_STEP.IMPORTED);
      
      const step2Result = service.advanceWorkflow(evalId, WORKFLOW_STEP.ONLINE_BUCKET_REVIEWED, '推荐策略老唐');
      expect(step2Result.needsReview).toBe(true);
      expect(step2Result.eval.status).toBe(EVAL_STATUS.NEEDS_RECHECK);
      
      service.reviewBucketDiff(evalId, noteIds[0], '评测运营小王', 'normal', '正常波动');
      
      const step3Result = service.advanceWorkflow(evalId, WORKFLOW_STEP.COMPARISON_UPDATED, '推荐策略老唐');
      expect(step3Result.eval.workflowStep).toBe(WORKFLOW_STEP.COMPARISON_UPDATED);
      expect(step3Result.eval.status).toBe(EVAL_STATUS.NORMAL);
    });
  });
});
