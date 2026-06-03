import { selfCheckService } from '../src/services/SelfCheckService';
import { dataStore } from '../src/store/DataStore';
import { ImportEmailRequest } from '../src/types';

describe('SelfCheckService', () => {
  beforeEach(() => {
    dataStore.clear();
  });

  describe('checkSplitLines', () => {
    it('应正确识别同一业务号拆成手续费和本金两行的情况', () => {
      const request: ImportEmailRequest = {
        emailSource: 'manager@test.com',
        emailContent: '业务号: YL20260601001\n金额: 100000.00',
        businessNo: 'YL20260601001',
        lines: [
          {
            lineType: 'PRINCIPAL',
            businessNo: 'YL20260601001',
            amount: 100000,
            currency: 'CNY',
            tradeDate: '2026-06-01',
            fundCode: 'F00001',
            fundName: '养老目标基金A'
          },
          {
            lineType: 'FEE',
            businessNo: 'YL20260601001',
            amount: 500,
            currency: 'CNY',
            tradeDate: '2026-06-01',
            fundCode: 'F00001',
            fundName: '养老目标基金A'
          }
        ],
        importedBy: '客户经理张三'
      };

      const record = dataStore.createRecordFromEmail(request);
      const issue = selfCheckService.checkSplitLines(record.id);

      expect(issue).not.toBeNull();
      expect(issue?.checkType).toBe('SPLIT_LINES_DETECTED');
      expect(issue?.result).toBe('WARNING');
      expect(issue?.description).toContain('拆分为手续费和本金两行');
      expect(issue?.description).toContain('需结算主管复核');
      expect(issue?.description).toContain('暂不归为正常');
    });

    it('单行记录应通过检查', () => {
      const request: ImportEmailRequest = {
        emailSource: 'manager@test.com',
        emailContent: '业务号: YL20260601002\n金额: 100000.00',
        businessNo: 'YL20260601002',
        lines: [{
          lineType: 'COMBINED',
          businessNo: 'YL20260601002',
          amount: 100000,
          currency: 'CNY',
          tradeDate: '2026-06-01',
          fundCode: 'F00001',
          fundName: '养老目标基金A'
        }],
        importedBy: '客户经理张三'
      };

      const record = dataStore.createRecordFromEmail(request);
      const issue = selfCheckService.checkSplitLines(record.id);

      expect(issue?.result).toBe('PASSED');
      expect(issue?.description).toContain('合并类型');
    });

    it('检测到拆分行时应更新状态为 SPLIT_LINES_PENDING', () => {
      const request: ImportEmailRequest = {
        emailSource: 'manager@test.com',
        emailContent: '业务号: YL20260601003',
        businessNo: 'YL20260601003',
        lines: [
          {
            lineType: 'PRINCIPAL',
            businessNo: 'YL20260601003',
            amount: 200000,
            currency: 'CNY',
            tradeDate: '2026-06-01',
            fundCode: 'F00001',
            fundName: '养老目标基金A'
          },
          {
            lineType: 'FEE',
            businessNo: 'YL20260601003',
            amount: 1000,
            currency: 'CNY',
            tradeDate: '2026-06-01',
            fundCode: 'F00001',
            fundName: '养老目标基金A'
          }
        ],
        importedBy: '客户经理张三'
      };

      const record = dataStore.createRecordFromEmail(request);
      expect(record.status).toBe('EMAIL_IMPORTED');

      selfCheckService.runAllChecks(record.id);

      const updatedRecord = dataStore.getRecord(record.id)!;
      expect(updatedRecord.status).toBe('SPLIT_LINES_PENDING');
    });
  });

  describe('checkDuplicateImport', () => {
    it('应检测到同一业务号的重复导入', () => {
      const request1: ImportEmailRequest = {
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

      dataStore.createRecordFromEmail(request1);

      const request2: ImportEmailRequest = {
        ...request1,
        emailSource: 'manager2@test.com',
        emailContent: '业务号: YL20260601001 (重复导入)'
      };

      const record2 = dataStore.createRecordFromEmail(request2);
      const issue = selfCheckService.checkDuplicateImport(record2.id);

      expect(issue?.result).toBe('WARNING');
      expect(issue?.description).toContain('已有 1 条其他记录');
    });
  });

  describe('recalculateLine', () => {
    it('应根据持有天数重新计算手续费并给出取舍理由', () => {
      const request: ImportEmailRequest = {
        emailSource: 'manager@test.com',
        emailContent: '业务号: YL20260601001',
        businessNo: 'YL20260601001',
        lines: [{
          lineType: 'FEE',
          businessNo: 'YL20260601001',
          amount: 1500,
          currency: 'CNY',
          tradeDate: '2026-06-01',
          fundCode: 'F00001',
          fundName: '养老目标基金A'
        }],
        importedBy: '客户经理张三'
      };

      const record = dataStore.createRecordFromEmail(request);
      const principalLine = { ...record.lines[0], amount: 100000 };
      const feeLine = { ...principalLine, lineType: 'FEE' as const, amount: 1500 };

      const result = selfCheckService.recalculateLine(principalLine, feeLine, 15);
      expect(result.feeRate).toBe(0.015);
      expect(result.reason).toContain('持有不满30天');
      expect(result.difference).toBeCloseTo(0, 5);

      const freeFeeLine = { ...feeLine, amount: 0 };
      const result2 = selfCheckService.recalculateLine(principalLine, freeFeeLine, 400);
      expect(result2.feeRate).toBe(0);
      expect(result2.reason).toContain('持有满1年');
      expect(result2.difference).toBeCloseTo(0, 5);
    });
  });

  describe('checkExportConsistency', () => {
    it('应验证页面、接口、明细三方数据一致性', () => {
      const request: ImportEmailRequest = {
        emailSource: 'manager@test.com',
        emailContent: '业务号: YL20260601001',
        businessNo: 'YL20260601001',
        lines: [
          {
            lineType: 'PRINCIPAL',
            businessNo: 'YL20260601001',
            amount: 100000,
            currency: 'CNY',
            tradeDate: '2026-06-01',
            fundCode: 'F00001',
            fundName: '养老目标基金A'
          },
          {
            lineType: 'FEE',
            businessNo: 'YL20260601001',
            amount: 500,
            currency: 'CNY',
            tradeDate: '2026-06-01',
            fundCode: 'F00001',
            fundName: '养老目标基金A'
          }
        ],
        importedBy: '客户经理张三'
      };

      const record = dataStore.createRecordFromEmail(request);
      const issue = selfCheckService.checkExportConsistency(record.id);

      expect(issue).not.toBeNull();
      expect(issue?.result).toBe('PASSED');
      expect(issue?.description).toContain('接口、页面、明细三方数据一致');
      expect(issue?.description).toContain('合计100500元');
    });

    it('应验证拆分行的交易日期和基金代码一致性', () => {
      const request: ImportEmailRequest = {
        emailSource: 'manager@test.com',
        emailContent: '业务号: YL20260601002',
        businessNo: 'YL20260601002',
        lines: [
          {
            lineType: 'PRINCIPAL',
            businessNo: 'YL20260601002',
            amount: 100000,
            currency: 'CNY',
            tradeDate: '2026-06-01',
            fundCode: 'F00001',
            fundName: '养老目标基金A'
          },
          {
            lineType: 'FEE',
            businessNo: 'YL20260601002',
            amount: 500,
            currency: 'CNY',
            tradeDate: '2026-06-02',
            fundCode: 'F00002',
            fundName: '养老目标基金B'
          }
        ],
        importedBy: '客户经理张三'
      };

      const record = dataStore.createRecordFromEmail(request);
      const issue = selfCheckService.checkExportConsistency(record.id);

      expect(issue?.result).toBe('WARNING');
      expect(issue?.description).toContain('交易日期不一致');
    });
  });

  describe('runAllChecks', () => {
    it('应运行所有四项自检并返回结果', () => {
      const request: ImportEmailRequest = {
        emailSource: 'manager@test.com',
        emailContent: '业务号: YL20260601001\n金额: 100000.00\n交易日期: 2026-06-01\n基金代码: F00001',
        businessNo: 'YL20260601001',
        lines: [
          {
            lineType: 'PRINCIPAL',
            businessNo: 'YL20260601001',
            amount: 100000,
            currency: 'CNY',
            tradeDate: '2026-06-01',
            fundCode: 'F00001',
            fundName: '养老目标基金A'
          },
          {
            lineType: 'FEE',
            businessNo: 'YL20260601001',
            amount: 500,
            currency: 'CNY',
            tradeDate: '2026-06-01',
            fundCode: 'F00001',
            fundName: '养老目标基金A'
          }
        ],
        importedBy: '客户经理张三'
      };

      const record = dataStore.createRecordFromEmail(request);
      const issues = selfCheckService.runAllChecks(record.id);

      expect(issues.length).toBe(4);

      const checkTypes = issues.map(i => i.checkType);
      expect(checkTypes).toContain('DUPLICATE_IMPORT');
      expect(checkTypes).toContain('SPLIT_LINES_DETECTED');
      expect(checkTypes).toContain('RECALCULATION_AFTER_SUPPLEMENT');
      expect(checkTypes).toContain('EXPORT_CONSISTENCY');

      const splitCheck = issues.find(i => i.checkType === 'SPLIT_LINES_DETECTED');
      expect(splitCheck?.result).toBe('WARNING');

      const updatedRecord = dataStore.getRecord(record.id)!;
      expect(updatedRecord.selfCheckIssues.length).toBe(4);
    });
  });
});
