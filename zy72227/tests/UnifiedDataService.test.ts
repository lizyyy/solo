import { unifiedDataService } from '../src/services/UnifiedDataService';
import { workflowService } from '../src/services/WorkflowService';
import { dataStore } from '../src/store/DataStore';
import { ImportEmailRequest } from '../src/types';

describe('UnifiedDataService - 统一数据源', () => {
  beforeEach(() => {
    dataStore.clear();
  });

  describe('数据一致性验证', () => {
    it('页面展示、接口返回、导出明细应读取同一份结果', async () => {
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

      const record = await workflowService.step1_importManagerEmail(request);

      const pageView = unifiedDataService.getPageView(record.id);
      expect(pageView).toBeDefined();
      expect(pageView?.totalPrincipal).toBe(100000);
      expect(pageView?.totalFee).toBe(500);
      expect(pageView?.totalAmount).toBe(100500);
      expect(pageView?.hasSplitLines).toBe(true);

      const apiView = unifiedDataService.getApiResponse(record.id);
      expect(apiView).toBeDefined();
      expect(apiView?.totalPrincipal).toBe(pageView?.totalPrincipal);
      expect(apiView?.totalFee).toBe(pageView?.totalFee);
      expect(apiView?.totalAmount).toBe(pageView?.totalAmount);
      expect(apiView?.hasSplitLines).toBe(pageView?.hasSplitLines);
      expect(apiView?.record.id).toBe(pageView?.record.id);

      const exportLines = unifiedDataService.getExportLines(record.id);
      expect(exportLines).toBeDefined();
      expect(exportLines?.length).toBe(1);

      const exportLine = exportLines![0];
      expect(exportLine.业务号).toBe(record.businessNo);
      expect(exportLine.本金金额).toBe(100000);
      expect(exportLine.手续费金额).toBe(500);
      expect(exportLine.合计金额).toBe(100500);
      expect(exportLine.是否拆分行).toBe('是');
      expect(exportLine.行类型).toBe('本金+手续费拆分');

      const consistency = unifiedDataService.verifyConsistency(record.id);
      expect(consistency.consistent).toBe(true);
      expect(consistency.pageTotal).toBe(consistency.apiTotal);
      expect(consistency.pageTotal).toBe(consistency.exportTotal);
      expect(consistency.exportDetails.principal).toBe(pageView?.totalPrincipal);
      expect(consistency.exportDetails.fee).toBe(pageView?.totalFee);
      expect(consistency.exportDetails.total).toBe(pageView?.totalAmount);
    });

    it('拆分行记录在页面、接口、导出中都应显示，不能一个地方显示异常另一个地方消失', async () => {
      const request: ImportEmailRequest = {
        emailSource: 'manager@test.com',
        emailContent: '业务号: YL20260601002',
        businessNo: 'YL20260601002',
        lines: [
          {
            lineType: 'PRINCIPAL',
            businessNo: 'YL20260601002',
            amount: 200000,
            currency: 'CNY',
            tradeDate: '2026-06-01',
            fundCode: 'F00001',
            fundName: '养老目标基金A'
          },
          {
            lineType: 'FEE',
            businessNo: 'YL20260601002',
            amount: 1500,
            currency: 'CNY',
            tradeDate: '2026-06-01',
            fundCode: 'F00001',
            fundName: '养老目标基金A'
          },
          {
            lineType: 'PRINCIPAL',
            businessNo: 'YL20260601002',
            amount: 300000,
            currency: 'CNY',
            tradeDate: '2026-06-02',
            fundCode: 'F00002',
            fundName: '养老目标基金B'
          },
          {
            lineType: 'FEE',
            businessNo: 'YL20260601002',
            amount: 2250,
            currency: 'CNY',
            tradeDate: '2026-06-02',
            fundCode: 'F00002',
            fundName: '养老目标基金B'
          }
        ],
        importedBy: '客户经理张三'
      };

      const record = await workflowService.step1_importManagerEmail(request);

      const pageView = unifiedDataService.getPageView(record.id);
      expect(pageView?.hasSplitLines).toBe(true);
      expect(pageView?.totalPrincipal).toBe(500000);
      expect(pageView?.totalFee).toBe(3750);
      expect(pageView?.totalAmount).toBe(503750);
      expect(pageView?.record.lines.length).toBe(4);

      const apiView = unifiedDataService.getApiResponse(record.id);
      expect(apiView?.hasSplitLines).toBe(true);
      expect(apiView?.totalPrincipal).toBe(500000);
      expect(apiView?.totalFee).toBe(3750);
      expect(apiView?.record.lines.length).toBe(4);

      const exportLines = unifiedDataService.getExportLines(record.id);
      expect(exportLines?.length).toBe(2);

      const principalLinesInExport = exportLines!.filter(l => l.本金金额 > 0);
      const feeLinesInExport = exportLines!.filter(l => l.手续费金额 > 0);
      expect(principalLinesInExport.length).toBe(2);
      expect(feeLinesInExport.length).toBe(2);

      const fund1Line = exportLines!.find(l => l.基金代码 === 'F00001')!;
      expect(fund1Line.本金金额).toBe(200000);
      expect(fund1Line.手续费金额).toBe(1500);
      expect(fund1Line.合计金额).toBe(201500);
      expect(fund1Line.交易日期).toBe('2026-06-01');

      const fund2Line = exportLines!.find(l => l.基金代码 === 'F00002')!;
      expect(fund2Line.本金金额).toBe(300000);
      expect(fund2Line.手续费金额).toBe(2250);
      expect(fund2Line.合计金额).toBe(302250);
      expect(fund2Line.交易日期).toBe('2026-06-02');

      const rawRecord = unifiedDataService.getRawRecord(record.id);
      expect(rawRecord?.lines.length).toBe(4);

      const consistency = unifiedDataService.verifyConsistency(record.id);
      expect(consistency.consistent).toBe(true);
    });

    it('导出的每条明细都应包含计算参数版本和取舍理由', async () => {
      const request: ImportEmailRequest = {
        emailSource: 'manager@test.com',
        emailContent: '业务号: YL20260601003',
        businessNo: 'YL20260601003',
        lines: [
          {
            lineType: 'PRINCIPAL',
            businessNo: 'YL20260601003',
            amount: 100000,
            currency: 'CNY',
            tradeDate: '2026-06-01',
            fundCode: 'F00001',
            fundName: '养老目标基金A'
          },
          {
            lineType: 'FEE',
            businessNo: 'YL20260601003',
            amount: 500,
            currency: 'CNY',
            tradeDate: '2026-06-01',
            fundCode: 'F00001',
            fundName: '养老目标基金A'
          }
        ],
        importedBy: '客户经理张三'
      };

      const record = await workflowService.step1_importManagerEmail(request);

      const exportLines = unifiedDataService.getExportLines(record.id);
      expect(exportLines?.length).toBe(1);

      const exportLine = exportLines![0];
      expect(exportLine.计算参数版本).toBeDefined();
      expect(exportLine.计算参数版本).toMatch(/^v\d+\.\d+\.\d+$/);
      expect(exportLine.计算取舍理由).toBeDefined();
      expect(exportLine.计算取舍理由.length).toBeGreaterThan(0);
      expect(exportLine.计算时间).toBeDefined();
      expect(exportLine.计算人).toBe('客户经理张三');

      const rawRecord = unifiedDataService.getRawRecord(record.id);
      const lineTraces = rawRecord?.lines.map(l => l.calculationTrace) || [];
      lineTraces.forEach(trace => {
        expect(trace.paramsVersion).toBeDefined();
        expect(trace.decisionReason).toBeDefined();
        expect(trace.calculatedAt).toBeDefined();
        expect(trace.calculatedBy).toBeDefined();
      });
    });

    it('CSV导出应与JSON导出数据一致', async () => {
      const request: ImportEmailRequest = {
        emailSource: 'manager@test.com',
        emailContent: '业务号: YL20260601004\n金额: 100000.00\n交易日期: 2026-06-01\n基金代码: F00001',
        businessNo: 'YL20260601004',
        lines: [{
          lineType: 'COMBINED',
          businessNo: 'YL20260601004',
          amount: 100000,
          currency: 'CNY',
          tradeDate: '2026-06-01',
          fundCode: 'F00001',
          fundName: '养老目标基金A'
        }],
        importedBy: '客户经理张三'
      };

      const record = await workflowService.step1_importManagerEmail(request);
      await workflowService.step2_supplySettlementBatch({
        recordId: record.id,
        settlementBatchNo: 'YL20260601004-20260601-F00001-100000.00',
        suppliedBy: '对账运营阿芬'
      });

      const csv = unifiedDataService.generateCsv(record.id);
      expect(csv).toBeDefined();
      expect(csv).toContain('业务号');
      expect(csv).toContain('YL20260601004');
      expect(csv).toContain('100000');
      expect(csv).toContain('F00001');
      expect(csv).toContain('养老目标基金A');
      expect(csv).toContain('计算参数版本');
      expect(csv).toContain('计算取舍理由');

      const exportLines = unifiedDataService.getExportLines(record.id);
      expect(exportLines?.length).toBe(1);
      expect(exportLines![0].业务号).toBe('YL20260601004');
      expect(exportLines![0].合计金额).toBe(100000);

      const consistency = unifiedDataService.verifyConsistency(record.id);
      expect(consistency.consistent).toBe(true);
    });
  });

  describe('待处理角色识别', () => {
    it('有冲突时待处理角色应包含 OPERATOR（对账运营阿芬）', async () => {
      const request: ImportEmailRequest = {
        emailSource: 'manager@test.com',
        emailContent: '业务号: YL20260601005\n金额: 100000.00\n交易日期: 2026-06-01\n基金代码: F00001',
        businessNo: 'YL20260601005',
        lines: [{
          lineType: 'COMBINED',
          businessNo: 'YL20260601005',
          amount: 100000,
          currency: 'CNY',
          tradeDate: '2026-06-01',
          fundCode: 'F00001',
          fundName: '养老目标基金A'
        }],
        importedBy: '客户经理张三'
      };

      const record = await workflowService.step1_importManagerEmail(request);
      await workflowService.step2_supplySettlementBatch({
        recordId: record.id,
        settlementBatchNo: 'YL20260601006-20260602-F00002-200000.00',
        suppliedBy: '对账运营阿芬'
      });

      const view = unifiedDataService.getPageView(record.id);
      expect(view?.hasConflicts).toBe(true);
      expect(view?.pendingActions).toContain('OPERATOR');
      expect(view?.pendingActions).not.toContain('SUPERVISOR');
    });

    it('有拆分行且状态为 SPLIT_LINES_PENDING 时待处理角色应包含 SUPERVISOR', async () => {
      const request: ImportEmailRequest = {
        emailSource: 'manager@test.com',
        emailContent: '业务号: YL20260601006',
        businessNo: 'YL20260601006',
        lines: [
          {
            lineType: 'PRINCIPAL',
            businessNo: 'YL20260601006',
            amount: 100000,
            currency: 'CNY',
            tradeDate: '2026-06-01',
            fundCode: 'F00001',
            fundName: '养老目标基金A'
          },
          {
            lineType: 'FEE',
            businessNo: 'YL20260601006',
            amount: 500,
            currency: 'CNY',
            tradeDate: '2026-06-01',
            fundCode: 'F00001',
            fundName: '养老目标基金A'
          }
        ],
        importedBy: '客户经理张三'
      };

      const record = await workflowService.step1_importManagerEmail(request);

      const view = unifiedDataService.getPageView(record.id);
      expect(view?.hasSplitLines).toBe(true);
      expect(view?.pendingActions).toContain('SUPERVISOR');
    });
  });
});
