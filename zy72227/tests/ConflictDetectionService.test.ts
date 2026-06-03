import { conflictDetectionService } from '../src/services/ConflictDetectionService';
import { dataStore } from '../src/store/DataStore';
import { ImportEmailRequest } from '../src/types';

describe('ConflictDetectionService', () => {
  beforeEach(() => {
    dataStore.clear();
  });

  describe('extractFromEmailContent', () => {
    it('应正确解析邮件内容中的结构化信息', () => {
      const content = '业务号: YL20260601001\n金额: 100000.00\n交易日期: 2026-06-01\n基金代码: F00001';
      const result = conflictDetectionService.extractFromEmailContent(content);
      expect(result).not.toBeNull();
      expect(result?.businessNo).toBe('YL20260601001');
      expect(result?.amount).toBe(100000);
      expect(result?.tradeDate).toBe('2026-06-01');
      expect(result?.fundCode).toBe('F00001');
    });

    it('应正确解析中文冒号', () => {
      const content = '业务号：YL20260601001\n金额：100000.00';
      const result = conflictDetectionService.extractFromEmailContent(content);
      expect(result?.businessNo).toBe('YL20260601001');
      expect(result?.amount).toBe(100000);
    });

    it('无法解析时返回null', () => {
      const content = '无结构化内容';
      const result = conflictDetectionService.extractFromEmailContent(content);
      expect(result).toBeNull();
    });
  });

  describe('extractFromBatchNo', () => {
    it('应正确解析清算批次号格式: 业务号-日期-基金代码-金额', () => {
      const batchNo = 'YL20260601001-20260601-F00001-100000.00';
      const result = conflictDetectionService.extractFromBatchNo(batchNo);
      expect(result).not.toBeNull();
      expect(result?.businessNo).toBe('YL20260601001');
      expect(result?.tradeDate).toBe('2026-06-01');
      expect(result?.fundCode).toBe('F00001');
      expect(result?.amount).toBe(100000);
    });

    it('格式错误时返回null', () => {
      const batchNo = 'INVALID_FORMAT';
      const result = conflictDetectionService.extractFromBatchNo(batchNo);
      expect(result).toBeNull();
    });
  });

  describe('detectBatchEmailMismatch', () => {
    it('应检测到业务号不一致的冲突', () => {
      const request: ImportEmailRequest = {
        emailSource: 'manager@test.com',
        emailContent: '业务号: YL20260601001\n金额: 100000.00\n交易日期: 2026-06-01\n基金代码: F00001',
        businessNo: 'YL20260601001',
        lines: [{
          lineType: 'COMBINED',
          businessNo: 'YL20260601001',
          amount: 100000,
          currency: 'CNY',
          tradeDate: '2026-06-01',
          fundCode: 'F00001',
          fundName: '养老目标基金A'
        }],
        importedBy: '客户经理张三'
      };

      const record = dataStore.createRecordFromEmail(request);
      dataStore.updateRecord(record.id, {
        settlementBatchNo: 'YL20260601002-20260601-F00001-100000.00'
      });

      const updatedRecord = dataStore.getRecord(record.id)!;
      const conflict = conflictDetectionService.detectBatchEmailMismatch(updatedRecord);
      expect(conflict).not.toBeNull();
      expect(conflict?.conflictType).toBe('BATCH_EMAIL_MISMATCH');
      expect(conflict?.description).toContain('业务号不一致');
    });

    it('数据一致时返回null', () => {
      const request: ImportEmailRequest = {
        emailSource: 'manager@test.com',
        emailContent: '业务号: YL20260601001\n金额: 100000.00\n交易日期: 2026-06-01\n基金代码: F00001',
        businessNo: 'YL20260601001',
        lines: [{
          lineType: 'COMBINED',
          businessNo: 'YL20260601001',
          amount: 100000,
          currency: 'CNY',
          tradeDate: '2026-06-01',
          fundCode: 'F00001',
          fundName: '养老目标基金A'
        }],
        importedBy: '客户经理张三'
      };

      const record = dataStore.createRecordFromEmail(request);
      dataStore.updateRecord(record.id, {
        settlementBatchNo: 'YL20260601001-20260601-F00001-100000.00'
      });

      const updatedRecord = dataStore.getRecord(record.id)!;
      const conflict = conflictDetectionService.detectBatchEmailMismatch(updatedRecord);
      expect(conflict).toBeNull();
    });

    it('无清算批次号时返回null', () => {
      const request: ImportEmailRequest = {
        emailSource: 'manager@test.com',
        emailContent: '业务号: YL20260601001',
        businessNo: 'YL20260601001',
        lines: [{
          lineType: 'COMBINED',
          businessNo: 'YL20260601001',
          amount: 100000,
          currency: 'CNY',
          tradeDate: '2026-06-01',
          fundCode: 'F00001',
          fundName: '养老目标基金A'
        }],
        importedBy: '客户经理张三'
      };

      const record = dataStore.createRecordFromEmail(request);
      const conflict = conflictDetectionService.detectBatchEmailMismatch(record);
      expect(conflict).toBeNull();
    });
  });

  describe('detectDuplicateImport', () => {
    it('应检测到重复导入', () => {
      const request: ImportEmailRequest = {
        emailSource: 'manager@test.com',
        emailContent: '业务号: YL20260601001',
        businessNo: 'YL20260601001',
        lines: [{
          lineType: 'COMBINED',
          businessNo: 'YL20260601001',
          amount: 100000,
          currency: 'CNY',
          tradeDate: '2026-06-01',
          fundCode: 'F00001',
          fundName: '养老目标基金A'
        }],
        importedBy: '客户经理张三'
      };

      dataStore.createRecordFromEmail(request);
      const conflict = conflictDetectionService.detectDuplicateImport('manager@test.com', 'YL20260601001');
      expect(conflict).not.toBeNull();
      expect(conflict?.conflictType).toBe('DUPLICATE_IMPORT');
      expect(conflict?.description).toContain('已有 1 条其他记录');
    });

    it('无重复时返回null', () => {
      const conflict = conflictDetectionService.detectDuplicateImport('new@test.com', 'NEW001');
      expect(conflict).toBeNull();
    });
  });

  describe('resolveConflict', () => {
    it('应正确解决冲突并记录操作人', () => {
      const request: ImportEmailRequest = {
        emailSource: 'manager@test.com',
        emailContent: '业务号: YL20260601001\n金额: 100000.00\n交易日期: 2026-06-01\n基金代码: F00001',
        businessNo: 'YL20260601001',
        lines: [{
          lineType: 'COMBINED',
          businessNo: 'YL20260601001',
          amount: 100000,
          currency: 'CNY',
          tradeDate: '2026-06-01',
          fundCode: 'F00001',
          fundName: '养老目标基金A'
        }],
        importedBy: '客户经理张三'
      };

      const record = dataStore.createRecordFromEmail(request);
      dataStore.updateRecord(record.id, {
        settlementBatchNo: 'YL20260601002-20260601-F00001-100000.00'
      });

      conflictDetectionService.detectAllConflicts(record.id);
      const recordWithConflicts = dataStore.getRecord(record.id)!;
      expect(recordWithConflicts.conflicts.length).toBeGreaterThan(0);
      expect(recordWithConflicts.status).toBe('CONFLICT_DETECTED');

      const conflictId = recordWithConflicts.conflicts[0].id;
      const resolved = conflictDetectionService.resolveConflict(
        record.id,
        conflictId,
        'CONFIRM_EMAIL',
        '对账运营阿芬'
      );

      expect(resolved).not.toBeNull();
      expect(resolved?.resolution).toBe('CONFIRM_EMAIL');
      expect(resolved?.resolvedBy).toBe('对账运营阿芬');
      expect(resolved?.resolvedAt).toBeDefined();

      const updatedRecord = dataStore.getRecord(record.id)!;
      expect(updatedRecord.conflicts[0].resolution).toBe('CONFIRM_EMAIL');
      expect(updatedRecord.status).toBe('CONFLICT_RESOLVED');
    });

    it('已解决的冲突不能重复解决', () => {
      const request: ImportEmailRequest = {
        emailSource: 'manager@test.com',
        emailContent: '业务号: YL20260601001\n金额: 100000.00\n交易日期: 2026-06-01\n基金代码: F00001',
        businessNo: 'YL20260601001',
        lines: [{
          lineType: 'COMBINED',
          businessNo: 'YL20260601001',
          amount: 100000,
          currency: 'CNY',
          tradeDate: '2026-06-01',
          fundCode: 'F00001',
          fundName: '养老目标基金A'
        }],
        importedBy: '客户经理张三'
      };

      const record = dataStore.createRecordFromEmail(request);
      dataStore.updateRecord(record.id, {
        settlementBatchNo: 'YL20260601002-20260601-F00001-100000.00'
      });

      conflictDetectionService.detectAllConflicts(record.id);
      const recordWithConflicts = dataStore.getRecord(record.id)!;
      const conflictId = recordWithConflicts.conflicts[0].id;

      conflictDetectionService.resolveConflict(
        record.id,
        conflictId,
        'CONFIRM_EMAIL',
        '对账运营阿芬'
      );

      const secondResolve = conflictDetectionService.resolveConflict(
        record.id,
        conflictId,
        'CONFIRM_BATCH',
        '对账运营阿芬'
      );

      expect(secondResolve).toBeNull();
    });
  });
});
