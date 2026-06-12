import { ConflictRecordService } from '../src/ConflictRecordService';
import { ProcessingStatus, WorkflowStep } from '../src/types';
import { BOUNDARY_RULES } from '../src/boundaryRules';

describe('ConflictRecordService', () => {
  let service: ConflictRecordService;

  beforeEach(() => {
    service = new ConflictRecordService();
  });

  describe('导入记录', () => {
    it('应该正确导入单条记录并保留原始行号、批次ID、撤回标记', () => {
      const { batch, records } = service.importRecords(
        [
          {
            originalRowNumber: 1,
            liveName: '青花瓷',
            copyrightName: '青花瓷',
            band: 'CH1',
            conflictDescription: '与话筒频段冲突',
          },
        ],
        '老周'
      );

      expect(records).toHaveLength(1);
      expect(records[0].originalRowNumber).toBe(1);
      expect(records[0].importedBy).toBe('老周');
      expect(records[0].workflowStep).toBe(WorkflowStep.INITIAL_IMPORT);
      expect(records[0].importBatchId).toBe(batch.id);
      expect(records[0].isRolledBack).toBe(false);
      expect(batch.recordIds).toContain(records[0].id);
    });

    it('应该自动检测双名歌曲并标记为待老师复核', () => {
      const { records } = service.importRecords(
        [
          {
            originalRowNumber: 1,
            liveName: '青花瓷(即兴版)',
            copyrightName: '青花瓷',
            band: 'CH1',
            conflictDescription: '频段冲突',
          },
        ],
        '老周'
      );

      expect(records[0].song.hasDualNames).toBe(true);
      expect(records[0].processingStatus).toBe(ProcessingStatus.NEEDS_TEACHER_REVIEW);
    });

    it('单名歌曲应该标记为待复核', () => {
      const { records } = service.importRecords(
        [
          {
            originalRowNumber: 1,
            liveName: '青花瓷',
            copyrightName: '青花瓷',
            band: 'CH1',
            conflictDescription: '频段冲突',
          },
        ],
        '老周'
      );

      expect(records[0].song.hasDualNames).toBe(false);
      expect(records[0].processingStatus).toBe(ProcessingStatus.PENDING_REVIEW);
    });
  });

  describe('导入批次回滚', () => {
    it('应该能撤回整个导入批次并记录原因、处理人、时间', () => {
      const { batch, records } = service.importRecords(
        [
          { originalRowNumber: 1, liveName: '晴天', copyrightName: '晴天', band: 'CH1', conflictDescription: '正常' },
          { originalRowNumber: 2, liveName: '七里香(现场版)', copyrightName: '七里香', band: 'CH2', conflictDescription: '冲突' },
        ],
        '老周',
        '授权期限页'
      );

      const rolledBack = service.rollbackImportBatch(batch.id, '老周', '导入的数据有误，整批撤回');

      expect(rolledBack).not.toBeNull();
      expect(rolledBack?.isRolledBack).toBe(true);
      expect(rolledBack?.rolledBackBy).toBe('老周');
      expect(rolledBack?.rollbackReason).toBe('导入的数据有误，整批撤回');
      expect(rolledBack?.rolledBackAt).toBeDefined();

      for (const recordId of batch.recordIds) {
        const record = service.getUnifiedRecordData(recordId);
        expect(record?.isRolledBack).toBe(true);
        const history = service.getRecordChangeHistory(recordId);
        const rollbackChange = history?.find((h) => h.field === 'isRolledBack');
        expect(rollbackChange).toBeDefined();
        expect(rollbackChange?.reason).toContain('导入的数据有误');
        expect(rollbackChange?.changedBy).toBe('老周');
      }
    });

    it('已撤回的批次不能再次撤回', () => {
      const { batch } = service.importRecords(
        [{ originalRowNumber: 1, liveName: '晴天', copyrightName: '晴天', band: 'CH1', conflictDescription: '正常' }],
        '老周'
      );
      service.rollbackImportBatch(batch.id, '老周', '测试');
      expect(() => service.rollbackImportBatch(batch.id, '老周', '再撤一次')).toThrow();
    });
  });

  describe('三步标准流程', () => {
    it('应该走完 第一次导入 → 补看留言 → 周报更新 三步', () => {
      const { records } = service.importRecords(
        [
          {
            originalRowNumber: 1,
            liveName: '晴天',
            copyrightName: '晴天',
            band: 'CH1',
            conflictDescription: '轻微干扰',
          },
        ],
        '老周'
      );

      const recordId = records[0].id;

      service.updateStatus(recordId, ProcessingStatus.NORMAL, '老周', '检查过没问题');
      expect(records[0].processingStatus).toBe(ProcessingStatus.NORMAL);

      service.addEngineerMessage(recordId, '调音师说：换个频段就好', '老周');
      const afterMessage = service.getUnifiedRecordData(recordId);
      expect(afterMessage?.workflowStep).toBe(WorkflowStep.ENGINEER_MESSAGE_ADDED);
      expect(afterMessage?.engineerMessage).toBe('调音师说：换个频段就好');
      expect(afterMessage?.manualChanges).toHaveLength(2);

      const report = service.createWeeklyReport('老周');
      expect(report.summary).toContain('正常1条');
      const afterReport = service.getUnifiedRecordData(recordId);
      expect(afterReport?.workflowStep).toBe(WorkflowStep.WEEKLY_REPORT_UPDATED);
    });

    it('双名歌曲在三步流程中应该保持待老师复核，不进入周报正常统计', () => {
      const { records } = service.importRecords(
        [
          {
            originalRowNumber: 1,
            liveName: '七里香(现场版)',
            copyrightName: '七里香',
            band: 'CH2',
            conflictDescription: '频段冲突',
          },
          {
            originalRowNumber: 2,
            liveName: '晴天',
            copyrightName: '晴天',
            band: 'CH1',
            conflictDescription: '正常',
          },
        ],
        '老周'
      );

      service.updateStatus(records[1].id, ProcessingStatus.NORMAL, '老周', '没问题');

      const report = service.createWeeklyReport('老周');
      expect(report.summary).toContain('待音乐老师复核1条');
      expect(report.teacherReviewCount).toBe(1);
      expect(report.normalCount).toBe(1);
      expect(report.totalCount).toBe(2);
      expect(report.content).toContain('七里香(现场版) / 七里香');
      expect(report.content).toContain('待音乐老师复核');
    });
  });

  describe('撤回和回滚', () => {
    it('应该能撤回到上一版周报', () => {
      service.importRecords(
        [
          {
            originalRowNumber: 1,
            liveName: '晴天',
            copyrightName: '晴天',
            band: 'CH1',
            conflictDescription: '正常',
          },
        ],
        '老周'
      );

      const recordId = service.getAllUnifiedRecords()[0].id;
      service.updateStatus(recordId, ProcessingStatus.NORMAL, '老周', '没问题');

      const report1 = service.createWeeklyReport('老周');

      service.importRecords(
        [
          {
            originalRowNumber: 2,
            liveName: '七里香',
            copyrightName: '七里香',
            band: 'CH2',
            conflictDescription: '正常',
          },
        ],
        '老周'
      );
      const record2Id = service.getAllUnifiedRecords()[1].id;
      service.updateStatus(record2Id, ProcessingStatus.NORMAL, '老周', '没问题');

      const report2 = service.createWeeklyReport('老周');
      expect(report2.summary).toContain('正常2条');

      const rolledBack = service.rollbackToPreviousReport();
      expect(rolledBack?.id).toBe(report1.id);
      expect(service.getCurrentWeeklyReport()?.id).toBe(report1.id);

      const recordsAfterRollback = service.getAllUnifiedRecords();
      expect(recordsAfterRollback[0].workflowStep).not.toBe(WorkflowStep.WEEKLY_REPORT_UPDATED);
    });

    it('撤回单条双名歌曲状态应该回到待老师复核', () => {
      const { records } = service.importRecords(
        [
          {
            originalRowNumber: 1,
            liveName: '青花瓷(即兴版)',
            copyrightName: '青花瓷',
            band: 'CH1',
            conflictDescription: '频段冲突',
          },
        ],
        '老周'
      );

      const recordId = records[0].id;
      service.updateStatus(recordId, ProcessingStatus.NORMAL, '音乐老师', '确认是同一首歌');

      const rolledBack = service.rollbackRecordStatus(recordId, '老周', '撤回刚才的判断');
      expect(rolledBack?.processingStatus).toBe(ProcessingStatus.NEEDS_TEACHER_REVIEW);
    });
  });

  describe('统一数据验证', () => {
    it('页面展示、导出、API应该返回同一份数据且ID可互查', () => {
      service.importRecords(
        [
          {
            originalRowNumber: 1,
            liveName: '青花瓷(即兴版)',
            copyrightName: '青花瓷',
            band: 'CH1',
            conflictDescription: '频段冲突',
          },
        ],
        '老周'
      );

      const pageData = service.getAllUnifiedRecords();
      const exportData = service.exportRecords();
      const apiData = service.getAllUnifiedRecords();

      expect(pageData).toEqual(apiData);

      const exportIds = exportData.split('\n').slice(1).filter(l => l.trim()).map(l => l.split(',')[0]);
      expect(exportIds).toContain(pageData[0].id);

      expect(exportData).toContain('青花瓷(即兴版)');
      expect(exportData).toContain('青花瓷');
      expect(exportData).toContain('是');
      expect(exportData).toContain('待音乐老师复核');
    });
  });

  describe('状态流转验证', () => {
    it('不允许非法的状态跳转', () => {
      const { records } = service.importRecords(
        [
          {
            originalRowNumber: 1,
            liveName: '晴天',
            copyrightName: '晴天',
            band: 'CH1',
            conflictDescription: '正常',
          },
        ],
        '老周'
      );

      expect(() => {
        service.updateStatus(
          records[0].id,
          ProcessingStatus.NORMAL,
          '老周',
          '直接跳'
        );
        service.updateStatus(
          records[0].id,
          ProcessingStatus.PENDING_REVIEW,
          '老周',
          '从正常跳回待复核是不允许的'
        );
      }).toThrow();
    });
  });

  describe('人工改动留痕', () => {
    it('应该记录所有人工改动，包括谁改的、改了啥、为啥改', () => {
      const { records } = service.importRecords(
        [
          {
            originalRowNumber: 1,
            liveName: '晴天',
            copyrightName: '晴天',
            band: 'CH1',
            conflictDescription: '正常',
          },
        ],
        '老周'
      );

      const recordId = records[0].id;
      service.updateStatus(recordId, ProcessingStatus.NORMAL, '老周', '检查过没问题');
      service.addEngineerMessage(recordId, '调音师留言', '老周');

      const history = service.getRecordChangeHistory(recordId);
      expect(history).toHaveLength(2);
      expect(history?.[0].changedBy).toBe('老周');
      expect(history?.[0].field).toBe('processingStatus');
      expect(history?.[0].reason).toBe('检查过没问题');
      expect(history?.[1].field).toBe('engineerMessage');
    });
  });

  describe('边界规则', () => {
    it('双名歌曲判断规则正确', () => {
      const song1 = { liveName: '青花瓷(即兴版)', copyrightName: '青花瓷', hasDualNames: false };
      const song2 = { liveName: '青花瓷', copyrightName: '青花瓷', hasDualNames: false };
      const song3 = { liveName: '', copyrightName: '青花瓷', hasDualNames: false };

      expect(BOUNDARY_RULES.songDualName.howToJudge(song1)).toBe(true);
      expect(BOUNDARY_RULES.songDualName.howToJudge(song2)).toBe(false);
      expect(BOUNDARY_RULES.songDualName.howToJudge(song3)).toBe(false);
    });
  });
});
