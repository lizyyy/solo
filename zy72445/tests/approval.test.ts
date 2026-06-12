import { ApprovalService } from '../src/services/ApprovalService';
import { DataStore } from '../src/store/DataStore';
import { ApprovalStatus, WorkflowStep, DisplayMode, ImportItemCategory } from '../src/types';

describe('剧院返场曲库审批系统', () => {
  let service: ApprovalService;
  let store: DataStore;

  beforeEach(() => {
    store = DataStore.getInstance();
    store.clearAll();
    service = new ApprovalService();
  });

  describe('曲目别名表导入与去重明细', () => {
    it('应成功导入并返回每条记录的分类明细', () => {
      const result = service.importTrackAliases(
        'BATCH-001',
        [
          { trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne', '小夜曲'] },
          { trackId: 'TRK002', trackName: '命运', aliases: ['Symphony No.5'] }
        ],
        'admin'
      );

      expect(result.success).toBe(true);
      expect(result.newRecordCount).toBe(2);
      expect(result.itemDetails.length).toBe(2);
      expect(result.itemDetails[0].category).toBe(ImportItemCategory.NEW_RECORD);
      expect(result.itemDetails[0].newRecordId).toBeDefined();
      expect(result.itemDetails[1].category).toBe(ImportItemCategory.NEW_RECORD);
      expect(service.getAllApprovals().length).toBe(2);
    });

    it('重复导入同一批次应标记为「本次重复」，不是历史重复', () => {
      service.importTrackAliases(
        'BATCH-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );

      const secondImport = service.importTrackAliases(
        'BATCH-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );

      expect(secondImport.thisTimeDuplicateCount).toBe(1);
      expect(secondImport.historicalDuplicateCount).toBe(0);
      expect(secondImport.newRecordCount).toBe(0);
      expect(secondImport.itemDetails[0].category).toBe(ImportItemCategory.THIS_TIME_DUPLICATE);
      expect(secondImport.itemDetails[0].existingBatchIdentifier).toBe('BATCH-001');
      expect(service.getAllApprovals().length).toBe(1);
    });

    it('不同批次但相同曲目ID应标记为「历史重复」，不是本次重复', () => {
      service.importTrackAliases(
        'BATCH-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );

      const result = service.importTrackAliases(
        'BATCH-002',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );

      expect(result.historicalDuplicateCount).toBe(1);
      expect(result.thisTimeDuplicateCount).toBe(0);
      expect(result.newRecordCount).toBe(0);
      expect(result.itemDetails[0].category).toBe(ImportItemCategory.HISTORICAL_DUPLICATE);
      expect(result.itemDetails[0].existingBatchIdentifier).toBe('BATCH-001');
    });

    it('混合导入应区分新记录和重复记录', () => {
      service.importTrackAliases(
        'BATCH-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );

      const result = service.importTrackAliases(
        'BATCH-002',
        [
          { trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] },
          { trackId: 'TRK002', trackName: '命运', aliases: ['Symphony No.5'] }
        ],
        'admin'
      );

      expect(result.newRecordCount).toBe(1);
      expect(result.historicalDuplicateCount).toBe(1);
      expect(result.itemDetails.find(d => d.trackId === 'TRK001')?.category).toBe(ImportItemCategory.HISTORICAL_DUPLICATE);
      expect(result.itemDetails.find(d => d.trackId === 'TRK002')?.category).toBe(ImportItemCategory.NEW_RECORD);
    });
  });

  describe('返工原因自动检测与处理', () => {
    beforeEach(() => {
      service.importTrackAliases(
        'BATCH-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );
    });

    it('轨道备注包含返工关键词时应自动检测', () => {
      const result = service.addTrackRemark(
        'TRK001',
        '这段录音有杂音，需要返工重录',
        'editor'
      );

      expect(result.success).toBe(true);
      expect(result.remark?.hasReworkReason).toBe(true);
      expect(result.warning?.message).toContain('返工原因');
    });

    it('检测到返工原因后应自动将审批状态设为 rework_required', () => {
      service.addTrackRemark('TRK001', '这段录音有杂音，需要返工重录', 'editor');
      const approval = service.getApprovalByTrackId('TRK001');
      expect(approval?.status).toBe(ApprovalStatus.REWORK_REQUIRED);
    });

    it('存在未处理返工原因时不能推进工作流', () => {
      service.addTrackRemark('TRK001', '这段录音有杂音，需要返工重录', 'editor');
      const approval = service.getApprovalByTrackId('TRK001');
      const result = service.advanceWorkflow(approval!.id, 'xiaolu');
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('返工原因');
    });

    it('处理完返工原因后应能继续推进', () => {
      const remarkResult = service.addTrackRemark(
        'TRK001',
        '这段录音有杂音，需要返工重录',
        'editor'
      );
      service.updateTrackRemark(remarkResult.remark!.id, '已重新录制，杂音已消除', 'xiaolu');
      const approval = service.getApprovalByTrackId('TRK001');
      const stepInfo = service.getWorkflowStepInfo(approval!.id);
      expect(stepInfo?.canAdvance).toBe(true);
    });
  });

  describe('三步工作流（含排练变更校验）', () => {
    beforeEach(() => {
      service.importTrackAliases(
        'BATCH-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );
    });

    it('应按顺序走完三步工作流', () => {
      const approval = service.getApprovalByTrackId('TRK001');
      expect(approval?.currentStep).toBe(WorkflowStep.ALIAS_IMPORT);

      const photo = service.uploadCheckinPhoto('CLASS-001', 'TRK001', 'https://example.com/photo.jpg', 'xiaolu');
      service.reviewCheckinPhoto(photo.id, 'xiaolu');

      const step1 = service.advanceWorkflow(approval!.id, 'xiaolu');
      expect(step1.success).toBe(true);
      expect(step1.record?.currentStep).toBe(WorkflowStep.PHOTO_REVIEW);

      service.addRehearsalChange('TRK001', '时长调整', '延长10秒', 'xiaolu');

      const step2 = service.advanceWorkflow(approval!.id, 'xiaolu');
      expect(step2.success).toBe(true);
      expect(step2.record?.currentStep).toBe(WorkflowStep.REHEARSAL_UPDATE);

      const step3 = service.advanceWorkflow(approval!.id, 'xiaolu');
      expect(step3.success).toBe(true);
      expect(step3.record?.status).toBe(ApprovalStatus.NORMAL);
    });

    it('没有签到照片时不能进入照片复核步骤', () => {
      const approval = service.getApprovalByTrackId('TRK001');
      const result = service.advanceWorkflow(approval!.id, 'xiaolu');
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('签到照片');
    });

    it('没有排练变更记录时不能从排练更新步骤完成', () => {
      const approval = service.getApprovalByTrackId('TRK001');
      const photo = service.uploadCheckinPhoto('CLASS-001', 'TRK001', 'https://example.com/photo.jpg', 'xiaolu');
      service.reviewCheckinPhoto(photo.id, 'xiaolu');

      service.advanceWorkflow(approval!.id, 'xiaolu');
      service.advanceWorkflow(approval!.id, 'xiaolu');

      const stepInfo = service.getWorkflowStepInfo(approval!.id);
      const rehearsalBlocker = stepInfo?.blockers.find(b => b.message.includes('排练变更记录'));
      expect(rehearsalBlocker).toBeDefined();
    });
  });

  describe('变更历史记录（关联导入批次和影响追踪）', () => {
    it('修改备注时应记录谁改了什么、影响哪条审批结果', () => {
      const importResult = service.importTrackAliases(
        'BATCH-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );

      const remarkResult = service.addTrackRemark('TRK001', '初始备注内容', 'editor');
      const approval = service.getApprovalByTrackId('TRK001');

      service.updateTrackRemark(remarkResult.remark!.id, '修改后的备注内容', 'xiaolu');

      const history = service.getChangeHistory('track_remark', remarkResult.remark!.id);
      expect(history.length).toBe(1);
      expect(history[0].oldValue).toBe('初始备注内容');
      expect(history[0].newValue).toBe('修改后的备注内容');
      expect(history[0].changedBy).toBe('xiaolu');
      expect(history[0].importBatchId).toBe(importResult.batchId);
      expect(history[0].affectedEntityType).toBe('approval_record');
      expect(history[0].affectedEntityId).toBe(approval!.id);
    });

    it('应能按导入批次查看所有变更历史', () => {
      const importResult = service.importTrackAliases(
        'BATCH-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );

      const remarkResult = service.addTrackRemark('TRK001', '初始备注', 'editor');
      service.updateTrackRemark(remarkResult.remark!.id, '修改备注', 'xiaolu');

      const batchHistory = service.getChangeHistoryByBatch(importResult.batchId);
      expect(batchHistory.length).toBeGreaterThan(0);
      const remarkChange = batchHistory.find(h => h.entityType === 'track_remark' && h.fieldName === 'content');
      expect(remarkChange).toBeDefined();
      expect(remarkChange?.importBatchId).toBe(importResult.batchId);
    });

    it('应能按受影响的审批记录查看变更历史', () => {
      service.importTrackAliases(
        'BATCH-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );

      const remarkResult = service.addTrackRemark('TRK001', '初始备注', 'editor');
      service.updateTrackRemark(remarkResult.remark!.id, '修改备注', 'xiaolu');

      const approval = service.getApprovalByTrackId('TRK001');
      const affectedHistory = service.getChangeHistoryByAffected('approval_record', approval!.id);
      expect(affectedHistory.length).toBeGreaterThan(0);
    });
  });

  describe('3D/图表展示规则', () => {
    beforeEach(() => {
      service.importTrackAliases(
        'BATCH-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );
    });

    it('存在未处理返工原因时不能切换到图表模式', () => {
      service.addTrackRemark('TRK001', '这段需要返工重录', 'editor');
      const approval = service.getApprovalByTrackId('TRK001');
      const result = service.setDisplayMode(approval!.id, DisplayMode.CHART, 'xiaolu');
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('服务复核');
    });

    it('无返工原因时可以切换到3D模式', () => {
      const approval = service.getApprovalByTrackId('TRK001');
      const result = service.setDisplayMode(approval!.id, DisplayMode.THREE_D, 'xiaolu');
      expect(result.success).toBe(true);
    });

    it('应能导航回曲目别名表和签到照片', () => {
      const photo = service.uploadCheckinPhoto('CLASS-001', 'TRK001', 'https://example.com/photo.jpg', 'xiaolu');
      service.addRehearsalChange('TRK001', '调整', '测试', 'xiaolu');

      const targets = service.getNavigationTargets('TRK001');
      const types = targets.map(t => t.type);
      expect(types).toContain('alias_table');
      expect(types).toContain('checkin_photo');
      expect(types).toContain('rehearsal_record');
    });

    it('点击导航目标应能正确跳转', () => {
      const alias = store.getTrackAliasByTrackId('TRK001');
      const result = service.navigateToSource('TRK001', 'alias_table', alias!.id);
      expect(result.success).toBe(true);
      expect(result.context?.source).toBe('alias_table');
    });
  });

  describe('回滚（恢复明细到对应版本）', () => {
    it('回滚应恢复审批状态和工作流步骤', () => {
      service.importTrackAliases(
        'BATCH-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );

      const photo = service.uploadCheckinPhoto('CLASS-001', 'TRK001', 'https://example.com/photo.jpg', 'xiaolu');
      service.reviewCheckinPhoto(photo.id, 'xiaolu');

      const approval = service.getApprovalByTrackId('TRK001');
      service.advanceWorkflow(approval!.id, 'xiaolu');

      const afterAdvance = service.getApprovalByTrackId('TRK001');
      expect(afterAdvance?.currentStep).toBe(WorkflowStep.PHOTO_REVIEW);

      const rollbackResult = service.rollback(approval!.id, 'xiaolu', '需要复核返工原因');
      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.record?.currentStep).toBe(WorkflowStep.ALIAS_IMPORT);
      expect(rollbackResult.record?.status).toBe(ApprovalStatus.PENDING);
    });

    it('回滚应恢复关联的轨道备注到快照版本', () => {
      service.importTrackAliases(
        'BATCH-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );

      const photo = service.uploadCheckinPhoto('CLASS-001', 'TRK001', 'https://example.com/photo.jpg', 'xiaolu');
      service.reviewCheckinPhoto(photo.id, 'xiaolu');

      service.addTrackRemark('TRK001', '原始备注', 'editor');

      const approval = service.getApprovalByTrackId('TRK001');
      service.advanceWorkflow(approval!.id, 'xiaolu');

      service.addTrackRemark('TRK001', '新增备注（推进一步后添加）', 'xiaolu');

      const remarksBefore = service.getTrackRemarks('TRK001');
      expect(remarksBefore.length).toBe(2);

      const rollbackResult = service.rollback(approval!.id, 'xiaolu', '需要恢复到推进前的备注状态');
      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.restoredRemarks).toBeGreaterThan(0);

      const remarksAfter = service.getTrackRemarks('TRK001');
      const restoredRemark = remarksAfter.find(r => r.content === '原始备注');
      expect(restoredRemark).toBeDefined();
    });

    it('已标记为正常的记录不能直接回滚', () => {
      service.importTrackAliases(
        'BATCH-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );

      const photo = service.uploadCheckinPhoto('CLASS-001', 'TRK001', 'https://example.com/photo.jpg', 'xiaolu');
      service.reviewCheckinPhoto(photo.id, 'xiaolu');
      service.addRehearsalChange('TRK001', '调整', '测试', 'xiaolu');

      const approval = service.getApprovalByTrackId('TRK001');
      service.advanceWorkflow(approval!.id, 'xiaolu');
      service.advanceWorkflow(approval!.id, 'xiaolu');
      service.advanceWorkflow(approval!.id, 'xiaolu');

      const rollbackResult = service.rollback(approval!.id, 'xiaolu', '想回滚');
      expect(rollbackResult.success).toBe(false);
      expect(rollbackResult.error?.message).toContain('正常');
    });

    it('回滚应在变更历史中记录关联的快照ID', () => {
      service.importTrackAliases(
        'BATCH-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );

      const photo = service.uploadCheckinPhoto('CLASS-001', 'TRK001', 'https://example.com/photo.jpg', 'xiaolu');
      service.reviewCheckinPhoto(photo.id, 'xiaolu');

      const approval = service.getApprovalByTrackId('TRK001');
      service.advanceWorkflow(approval!.id, 'xiaolu');
      service.rollback(approval!.id, 'xiaolu', '测试回滚');

      const history = service.getChangeHistory('approval_record', approval!.id);
      const rollbackEntry = history.find(h => h.changeReason?.includes('回滚'));
      expect(rollbackEntry).toBeDefined();
      expect(rollbackEntry?.snapshotId).toBeDefined();
    });
  });

  describe('申请返工', () => {
    it('已标记为正常的记录可以申请返工', () => {
      service.importTrackAliases(
        'BATCH-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );

      const photo = service.uploadCheckinPhoto('CLASS-001', 'TRK001', 'https://example.com/photo.jpg', 'xiaolu');
      service.reviewCheckinPhoto(photo.id, 'xiaolu');
      service.addRehearsalChange('TRK001', '调整', '测试', 'xiaolu');

      const approval = service.getApprovalByTrackId('TRK001');
      service.advanceWorkflow(approval!.id, 'xiaolu');
      service.advanceWorkflow(approval!.id, 'xiaolu');
      service.advanceWorkflow(approval!.id, 'xiaolu');

      expect(service.getApprovalByTrackId('TRK001')?.status).toBe(ApprovalStatus.NORMAL);

      const applyResult = service.applyForRework(approval!.id, '发现版权问题需要重新审核', 'editor');
      expect(applyResult.success).toBe(true);

      const apps = service.getReworkApplications(approval!.id);
      expect(apps.length).toBe(1);
      expect(apps[0].status).toBe('pending_review');
      expect(apps[0].reason).toBe('发现版权问题需要重新审核');
    });

    it('申请返工必须填写原因', () => {
      service.importTrackAliases(
        'BATCH-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );

      const approval = service.getApprovalByTrackId('TRK001');
      const applyResult = service.applyForRework(approval!.id, '', 'editor');
      expect(applyResult.success).toBe(false);
      expect(applyResult.error?.message).toContain('原因');
    });

    it('批准返工申请后审批状态变为 rework_required', () => {
      service.importTrackAliases(
        'BATCH-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );

      const photo = service.uploadCheckinPhoto('CLASS-001', 'TRK001', 'https://example.com/photo.jpg', 'xiaolu');
      service.reviewCheckinPhoto(photo.id, 'xiaolu');
      service.addRehearsalChange('TRK001', '调整', '测试', 'xiaolu');

      const approval = service.getApprovalByTrackId('TRK001');
      service.advanceWorkflow(approval!.id, 'xiaolu');
      service.advanceWorkflow(approval!.id, 'xiaolu');
      service.advanceWorkflow(approval!.id, 'xiaolu');

      service.applyForRework(approval!.id, '版权问题', 'editor');

      const apps = service.getReworkApplications(approval!.id);
      service.approveReworkApplication(apps[0].id, 'xiaolu');

      expect(service.getApprovalByTrackId('TRK001')?.status).toBe(ApprovalStatus.REWORK_REQUIRED);
    });

    it('驳回返工申请后审批状态不变', () => {
      service.importTrackAliases(
        'BATCH-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );

      const photo = service.uploadCheckinPhoto('CLASS-001', 'TRK001', 'https://example.com/photo.jpg', 'xiaolu');
      service.reviewCheckinPhoto(photo.id, 'xiaolu');
      service.addRehearsalChange('TRK001', '调整', '测试', 'xiaolu');

      const approval = service.getApprovalByTrackId('TRK001');
      service.advanceWorkflow(approval!.id, 'xiaolu');
      service.advanceWorkflow(approval!.id, 'xiaolu');
      service.advanceWorkflow(approval!.id, 'xiaolu');

      service.applyForRework(approval!.id, '版权问题', 'editor');

      const apps = service.getReworkApplications(approval!.id);
      service.rejectReworkApplication(apps[0].id, 'xiaolu');

      expect(service.getApprovalByTrackId('TRK001')?.status).toBe(ApprovalStatus.NORMAL);
    });

    it('不能重复提交待审核的返工申请', () => {
      service.importTrackAliases(
        'BATCH-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );

      const approval = service.getApprovalByTrackId('TRK001');
      service.applyForRework(approval!.id, '第一次申请', 'editor');

      const secondApply = service.applyForRework(approval!.id, '第二次申请', 'editor');
      expect(secondApply.success).toBe(false);
      expect(secondApply.error?.message).toContain('待审核');
    });
  });

  describe('错误提示人性化', () => {
    it('找不到曲目时应返回人话错误', () => {
      const result = service.addTrackRemark('INVALID_ID', '测试', 'xiaolu');
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('找不到对应的曲目记录');
      expect(result.error?.suggestion).toContain('检查曲目ID');
      expect(result.error?.message).not.toContain('track_not_found');
    });

    it('批次标识为空时应返回明确提示', () => {
      const result = service.importTrackAliases(
        '',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toBe('导入批次标识不能为空');
    });

    it('没有排练变更记录时应返回明确提示', () => {
      service.importTrackAliases(
        'BATCH-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );

      const photo = service.uploadCheckinPhoto('CLASS-001', 'TRK001', 'https://example.com/photo.jpg', 'xiaolu');
      service.reviewCheckinPhoto(photo.id, 'xiaolu');

      const approval = service.getApprovalByTrackId('TRK001');
      service.advanceWorkflow(approval!.id, 'xiaolu');
      service.advanceWorkflow(approval!.id, 'xiaolu');

      const result = service.advanceWorkflow(approval!.id, 'xiaolu');
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('排练变更记录');
    });
  });

  describe('完整场景：曲目别名表第一次导入 + 小鹿改备注 + 服务复核 + 重复导入', () => {
    it('应走完完整审批流程并核对所有关联', () => {
      const importResult = service.importTrackAliases(
        'BATCH-2024-001',
        [
          { trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] },
          { trackId: 'TRK002', trackName: '命运', aliases: ['Symphony No.5'] }
        ],
        'admin'
      );
      expect(importResult.newRecordCount).toBe(2);
      expect(importResult.itemDetails.every(d => d.category === ImportItemCategory.NEW_RECORD)).toBe(true);

      const photo = service.uploadCheckinPhoto(
        'CLASS-001',
        'TRK001',
        'https://example.com/checkin.jpg',
        'xiaolu'
      );
      service.reviewCheckinPhoto(photo.id, 'xiaolu');

      const remarkResult = service.addTrackRemark(
        'TRK001',
        '这段录音有杂音，需要返工重录',
        'editor'
      );
      expect(remarkResult.remark?.hasReworkReason).toBe(true);

      const approval = service.getApprovalByTrackId('TRK001');
      expect(approval?.status).toBe(ApprovalStatus.REWORK_REQUIRED);

      const blockedResult = service.advanceWorkflow(approval!.id, 'xiaolu');
      expect(blockedResult.success).toBe(false);
      expect(blockedResult.error?.message).toContain('返工原因');

      service.updateTrackRemark(remarkResult.remark!.id, '已处理，杂音已消除', 'xiaolu');

      const remarkHistory = service.getChangeHistory('track_remark', remarkResult.remark!.id);
      expect(remarkHistory.length).toBe(1);
      expect(remarkHistory[0].oldValue).toContain('杂音');
      expect(remarkHistory[0].newValue).toContain('已处理');
      expect(remarkHistory[0].changedBy).toBe('xiaolu');
      expect(remarkHistory[0].importBatchId).toBe(importResult.batchId);
      expect(remarkHistory[0].affectedEntityType).toBe('approval_record');
      expect(remarkHistory[0].affectedEntityId).toBe(approval!.id);

      const chartResult = service.setDisplayMode(approval!.id, DisplayMode.CHART, 'xiaolu');
      expect(chartResult.success).toBe(true);

      service.addRehearsalChange('TRK001', '时长调整', '延长10秒', 'xiaolu');

      const step1 = service.advanceWorkflow(approval!.id, 'xiaolu');
      expect(step1.success).toBe(true);
      expect(step1.record?.currentStep).toBe(WorkflowStep.PHOTO_REVIEW);

      service.addRehearsalChange('TRK001', '版本修正', '更新版本号', 'xiaolu');

      const step2 = service.advanceWorkflow(approval!.id, 'xiaolu');
      expect(step2.success).toBe(true);
      expect(step2.record?.currentStep).toBe(WorkflowStep.REHEARSAL_UPDATE);

      const step3 = service.advanceWorkflow(approval!.id, 'xiaolu');
      expect(step3.success).toBe(true);
      expect(step3.record?.status).toBe(ApprovalStatus.NORMAL);

      const duplicateImport = service.importTrackAliases(
        'BATCH-2024-001',
        [
          { trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] },
          { trackId: 'TRK002', trackName: '命运', aliases: ['Symphony No.5'] }
        ],
        'admin'
      );
      expect(duplicateImport.thisTimeDuplicateCount).toBe(2);
      expect(duplicateImport.historicalDuplicateCount).toBe(0);
      expect(duplicateImport.newRecordCount).toBe(0);
      expect(service.getAllApprovals().length).toBe(2);

      const crossBatchImport = service.importTrackAliases(
        'BATCH-2024-002',
        [
          { trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] },
          { trackId: 'TRK003', trackName: '月光', aliases: ['Moonlight'] }
        ],
        'admin'
      );
      expect(crossBatchImport.historicalDuplicateCount).toBe(1);
      expect(crossBatchImport.newRecordCount).toBe(1);
      expect(crossBatchImport.itemDetails.find(d => d.trackId === 'TRK001')?.category).toBe(ImportItemCategory.HISTORICAL_DUPLICATE);
      expect(crossBatchImport.itemDetails.find(d => d.trackId === 'TRK003')?.category).toBe(ImportItemCategory.NEW_RECORD);

      const batchHistory = service.getChangeHistoryByBatch(importResult.batchId);
      expect(batchHistory.length).toBeGreaterThan(0);
    });

    it('版权运营小鹿只改了一条备注，变更历史要能讲清谁改了什么、改完影响了哪条结果', () => {
      const importResult = service.importTrackAliases(
        'BATCH-2024-001',
        [
          { trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] },
          { trackId: 'TRK002', trackName: '命运', aliases: ['Symphony No.5'] }
        ],
        'admin'
      );

      service.addTrackRemark('TRK001', 'TRK001的初始备注', 'editor');
      service.addTrackRemark('TRK002', 'TRK002的初始备注', 'editor');

      const trk001Remarks = service.getTrackRemarks('TRK001');
      const trk002Remarks = service.getTrackRemarks('TRK002');
      const approval1 = service.getApprovalByTrackId('TRK001');
      const approval2 = service.getApprovalByTrackId('TRK002');

      service.updateTrackRemark(trk001Remarks[0].id, '小鹿修改后的备注', 'xiaolu');

      const history1 = service.getChangeHistory('track_remark', trk001Remarks[0].id);
      expect(history1.length).toBe(1);
      expect(history1[0].changedBy).toBe('xiaolu');
      expect(history1[0].oldValue).toBe('TRK001的初始备注');
      expect(history1[0].newValue).toBe('小鹿修改后的备注');
      expect(history1[0].affectedEntityType).toBe('approval_record');
      expect(history1[0].affectedEntityId).toBe(approval1!.id);
      expect(history1[0].importBatchId).toBe(importResult.batchId);

      const history2 = service.getChangeHistory('track_remark', trk002Remarks[0].id);
      expect(history2.length).toBe(0);

      const affectedHistory = service.getChangeHistoryByAffected('approval_record', approval1!.id);
      const remarkAffect = affectedHistory.find(h => h.entityType === 'track_remark');
      expect(remarkAffect).toBeDefined();
      expect(remarkAffect?.changedBy).toBe('xiaolu');

      const notAffectedHistory = service.getChangeHistoryByAffected('approval_record', approval2!.id);
      const remarkNotAffect = notAffectedHistory.find(h => h.entityType === 'track_remark' && h.changedBy === 'xiaolu');
      expect(remarkNotAffect).toBeUndefined();
    });
  });
});
