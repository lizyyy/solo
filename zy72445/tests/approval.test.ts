import { ApprovalService } from '../src/services/ApprovalService';
import { DataStore } from '../src/store/DataStore';
import { ApprovalStatus, WorkflowStep, DisplayMode } from '../src/types';

describe('剧院返场曲库审批系统', () => {
  let service: ApprovalService;
  let store: DataStore;

  beforeEach(() => {
    store = DataStore.getInstance();
    store.clearAll();
    service = new ApprovalService();
  });

  describe('曲目别名表导入与去重', () => {
    it('应成功导入曲目别名表并创建审批记录', () => {
      const result = service.importTrackAliases(
        'BATCH-001',
        [
          { trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne', '小夜曲'] },
          { trackId: 'TRK002', trackName: '命运', aliases: ['Symphony No.5'] }
        ],
        'admin'
      );

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(2);
      expect(result.skippedCount).toBe(0);
      expect(service.getAllApprovals().length).toBe(2);
    });

    it('重复导入同一批次不应导致数量翻倍', () => {
      const firstImport = service.importTrackAliases(
        'BATCH-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );
      expect(firstImport.importedCount).toBe(1);

      const secondImport = service.importTrackAliases(
        'BATCH-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );

      expect(secondImport.importedCount).toBe(0);
      expect(secondImport.skippedCount).toBe(1);
      expect(secondImport.errors.length).toBeGreaterThan(0);
      expect(secondImport.errors[0].message).toContain('已经导入过');
      expect(service.getAllApprovals().length).toBe(1);
    });

    it('不同批次但相同曲目ID也应去重', () => {
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

      expect(result.importedCount).toBe(0);
      expect(result.skippedCount).toBe(1);
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
      expect(result.warning).toBeDefined();
      expect(result.warning?.message).toContain('返工原因');
    });

    it('检测到返工原因后应自动将审批状态设为 rework_required', () => {
      service.addTrackRemark(
        'TRK001',
        '这段录音有杂音，需要返工重录',
        'editor'
      );

      const approval = service.getApprovalByTrackId('TRK001');
      expect(approval?.status).toBe(ApprovalStatus.REWORK_REQUIRED);
    });

    it('存在未处理返工原因时不能推进工作流', () => {
      service.addTrackRemark(
        'TRK001',
        '这段录音有杂音，需要返工重录',
        'editor'
      );

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

      service.updateTrackRemark(
        remarkResult.remark!.id,
        '已重新录制，杂音已消除',
        'xiaolu'
      );

      const approval = service.getApprovalByTrackId('TRK001');
      const stepInfo = service.getWorkflowStepInfo(approval!.id);
      expect(stepInfo?.canAdvance).toBe(true);
    });
  });

  describe('三步工作流', () => {
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

    it('不能跳步执行', () => {
      const approval = service.getApprovalByTrackId('TRK001');
      const photo = service.uploadCheckinPhoto('CLASS-001', 'TRK001', 'https://example.com/photo.jpg', 'xiaolu');
      service.reviewCheckinPhoto(photo.id, 'xiaolu');

      const info = service.getWorkflowStepInfo(approval!.id);
      expect(info?.step).toBe(WorkflowStep.ALIAS_IMPORT);
      expect(info?.stepName).toBe('曲目别名表导入');
    });
  });

  describe('变更历史记录', () => {
    beforeEach(() => {
      service.importTrackAliases(
        'BATCH-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );
    });

    it('修改备注时应记录改前改后的差别', () => {
      const remarkResult = service.addTrackRemark(
        'TRK001',
        '初始备注内容',
        'editor'
      );

      service.updateTrackRemark(
        remarkResult.remark!.id,
        '修改后的备注内容',
        'xiaolu'
      );

      const history = service.getChangeHistory('track_remark', remarkResult.remark!.id);
      expect(history.length).toBe(1);
      expect(history[0].oldValue).toBe('初始备注内容');
      expect(history[0].newValue).toBe('修改后的备注内容');
      expect(history[0].changedBy).toBe('xiaolu');
    });

    it('应能查看审批状态变更历史', () => {
      const remarkResult = service.addTrackRemark(
        'TRK001',
        '这段需要返工',
        'editor'
      );

      const approval = service.getApprovalByTrackId('TRK001');
      const history = service.getChangeHistory('approval_record', approval!.id);

      expect(history.length).toBeGreaterThan(0);
      const statusChange = history.find(h => h.fieldName === 'status');
      expect(statusChange).toBeDefined();
      expect(statusChange?.newValue).toBe(ApprovalStatus.REWORK_REQUIRED);
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
      service.addTrackRemark(
        'TRK001',
        '这段需要返工重录',
        'editor'
      );

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
      expect(result.errors[0].suggestion).toContain('填写批次号');
    });
  });

  describe('完整场景：三步审批+中途返工', () => {
    it('应能走完含返工的完整审批流程', () => {
      const importResult = service.importTrackAliases(
        'BATCH-2024-001',
        [{ trackId: 'TRK001', trackName: '夜曲', aliases: ['Nocturne'] }],
        'admin'
      );
      expect(importResult.importedCount).toBe(1);

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

      service.updateTrackRemark(
        remarkResult.remark!.id,
        '已处理，杂音已消除',
        'xiaolu'
      );

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

      const history = service.getChangeHistory('track_remark', remarkResult.remark!.id);
      expect(history.length).toBe(1);
      expect(history[0].oldValue).toContain('杂音');
      expect(history[0].newValue).toContain('已处理');
    });
  });
});
