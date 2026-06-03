import { workflowService } from '../src/services/WorkflowService';
import { dataStore } from '../src/store/DataStore';
import { ImportEmailRequest } from '../src/types';

describe('WorkflowService - 三步完整流程', () => {
  beforeEach(() => {
    dataStore.clear();
  });

  describe('普通单行业务流程（无拆分、无冲突）', () => {
    it('应完整走完三步流程：邮件导入→补录批次→更新差异清单', async () => {
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

      const step1Result = await workflowService.step1_importManagerEmail(request);
      expect(step1Result.status).toBe('EMAIL_IMPORTED');
      expect(step1Result.managerEmailImportedBy).toBe('客户经理张三');

      const summary1 = workflowService.getWorkflowSummary(step1Result.id);
      expect(summary1.currentStep).toBe(1);
      expect(summary1.completedSteps).toContain('客户经理补充邮件导入');

      const nextStep1 = workflowService.canProceedToNextStep(step1Result.id);
      expect(nextStep1.canProceed).toBe(true);
      expect(nextStep1.nextStep).toBe('补录清算批次号');

      const step2Result = await workflowService.step2_supplySettlementBatch({
        recordId: step1Result.id,
        settlementBatchNo: 'YL20260601001-20260601-F00001-100000.00',
        suppliedBy: '对账运营阿芬'
      });
      expect(step2Result).not.toBeNull();
      expect(step2Result?.status).toBe('BATCH_SUPPLIED');
      expect(step2Result?.settlementBatchNo).toBe('YL20260601001-20260601-F00001-100000.00');
      expect(step2Result?.settlementBatchSuppliedBy).toBe('对账运营阿芬');

      const summary2 = workflowService.getWorkflowSummary(step1Result.id);
      expect(summary2.currentStep).toBe(2);
      expect(summary2.completedSteps).toContain('对账运营补录清算批次号');

      const nextStep2 = workflowService.canProceedToNextStep(step1Result.id);
      expect(nextStep2.canProceed).toBe(true);
      expect(nextStep2.nextStep).toBe('更新差异清单');

      const step3Result = await workflowService.step3_updateDiffList(step1Result.id, '对账运营阿芬');
      expect(step3Result).not.toBeNull();
      expect(step3Result?.status).toBe('DIFF_UPDATED');
      expect(step3Result?.diffListUpdatedAt).toBeDefined();

      const summary3 = workflowService.getWorkflowSummary(step1Result.id);
      expect(summary3.currentStep).toBe(3);
      expect(summary3.completedSteps).toContain('差异清单更新');

      const finalResult = await workflowService.completeRecord(step1Result.id, '对账运营阿芬');
      expect(finalResult?.status).toBe('COMPLETED');

      const summary4 = workflowService.getWorkflowSummary(step1Result.id);
      expect(summary4.currentStep).toBe(4);
    });
  });

  describe('同一业务号拆成手续费和本金两行的流程', () => {
    it('应在碰到拆分行时留待结算主管复核，不自动归为正常', async () => {
      const request: ImportEmailRequest = {
        emailSource: 'manager@test.com',
        emailContent: '业务号: YL20260601002\n金额: 100000.00\n交易日期: 2026-06-01\n基金代码: F00001',
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
            amount: 0,
            currency: 'CNY',
            tradeDate: '2026-06-01',
            fundCode: 'F00001',
            fundName: '养老目标基金A'
          }
        ],
        importedBy: '客户经理张三'
      };

      const step1Result = await workflowService.step1_importManagerEmail(request);
      expect(step1Result.status).toBe('SPLIT_LINES_PENDING');

      const step2Result = await workflowService.step2_supplySettlementBatch({
        recordId: step1Result.id,
        settlementBatchNo: 'YL20260601002-20260601-F00001-100000.00',
        suppliedBy: '对账运营阿芬'
      });
      expect(step2Result?.status).toBe('BATCH_SUPPLIED');

      const nextStepBeforeReview = workflowService.canProceedToNextStep(step1Result.id);
      expect(nextStepBeforeReview.nextStep).toBe('结算主管复核拆分行');

      await expect(
        workflowService.step3_updateDiffList(step1Result.id, '对账运营阿芬')
      ).rejects.toThrow('拆分行记录需先经结算主管复核后才能更新差异清单');

      const reviewResult = await workflowService.supervisorReview({
        recordId: step1Result.id,
        reviewedBy: '结算主管李四',
        approved: true,
        reviewComment: '拆分行金额核对无误，手续费500元符合费率标准'
      });
      expect(reviewResult?.status).toBe('SUPERVISOR_REVIEWED');
      expect(reviewResult?.supervisorReviewedBy).toBe('结算主管李四');

      const nextStepAfterReview = workflowService.canProceedToNextStep(step1Result.id);
      expect(nextStepAfterReview.canProceed).toBe(true);
      expect(nextStepAfterReview.nextStep).toBe('更新差异清单');

      const step3Result = await workflowService.step3_updateDiffList(step1Result.id, '对账运营阿芬');
      expect(step3Result?.status).toBe('DIFF_UPDATED');
    });

    it('结算主管未通过复核时不能进入下一步', async () => {
      const request: ImportEmailRequest = {
        emailSource: 'manager@test.com',
        emailContent: '业务号: YL20260601003\n金额: 200000.00\n交易日期: 2026-06-01\n基金代码: F00001',
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
            amount: 0,
            currency: 'CNY',
            tradeDate: '2026-06-01',
            fundCode: 'F00001',
            fundName: '养老目标基金A'
          }
        ],
        importedBy: '客户经理张三'
      };

      const step1Result = await workflowService.step1_importManagerEmail(request);
      await workflowService.step2_supplySettlementBatch({
        recordId: step1Result.id,
        settlementBatchNo: 'YL20260601003-20260601-F00001-200000.00',
        suppliedBy: '对账运营阿芬'
      });

      const reviewResult = await workflowService.supervisorReview({
        recordId: step1Result.id,
        reviewedBy: '结算主管李四',
        approved: false,
        reviewComment: '业务归属有误，请核对'
      });
      expect(reviewResult?.status).toBe('BATCH_SUPPLIED');

      await expect(
        workflowService.step3_updateDiffList(step1Result.id, '对账运营阿芬')
      ).rejects.toThrow('拆分行记录需先经结算主管复核后才能更新差异清单');
    });
  });

  describe('邮件和清算批次号冲突的流程', () => {
    it('应列出冲突证据，让对账运营阿芬选择确认或驳回，不自动拍板', async () => {
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

      const step1Result = await workflowService.step1_importManagerEmail(request);

      const step2Result = await workflowService.step2_supplySettlementBatch({
        recordId: step1Result.id,
        settlementBatchNo: 'YL20260601005-20260602-F00002-200000.00',
        suppliedBy: '对账运营阿芬'
      });

      const recordWithConflict = dataStore.getRecord(step1Result.id)!;
      expect(recordWithConflict.conflicts.length).toBeGreaterThan(0);
      expect(recordWithConflict.status).toBe('CONFLICT_DETECTED');

      const conflict = recordWithConflict.conflicts[0];
      expect(conflict.conflictType).toBe('BATCH_EMAIL_MISMATCH');
      expect(conflict.emailValue).toBeDefined();
      expect(conflict.batchValue).toBeDefined();
      expect(conflict.description).toContain('业务号不一致');
      expect(conflict.description).toContain('金额不一致');
      expect(conflict.description).toContain('交易日期不一致');
      expect(conflict.description).toContain('基金代码不一致');

      const nextStep = workflowService.canProceedToNextStep(step1Result.id);
      expect(nextStep.canProceed).toBe(false);
      expect(nextStep.nextStep).toBe('处理冲突（确认/驳回）');
      expect(nextStep.blockers).toContain('请先处理所有冲突');

      await expect(
        workflowService.step3_updateDiffList(step1Result.id, '对账运营阿芬')
      ).rejects.toThrow('存在未解决的冲突，请先处理冲突');

      const resolvedRecord = await workflowService.resolveConflict({
        recordId: step1Result.id,
        conflictId: conflict.id,
        resolution: 'CONFIRM_EMAIL',
        resolvedBy: '对账运营阿芬'
      });
      expect(resolvedRecord?.conflicts[0].resolution).toBe('CONFIRM_EMAIL');
      expect(resolvedRecord?.status).toBe('CONFLICT_RESOLVED');

      const step3Result = await workflowService.step3_updateDiffList(step1Result.id, '对账运营阿芬');
      expect(step3Result?.status).toBe('DIFF_UPDATED');
    });
  });

  describe('计算透明度验证', () => {
    it('每条明细行应带有参数版本和取舍理由', async () => {
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

      record.lines.forEach(line => {
        expect(line.calculationTrace).toBeDefined();
        expect(line.calculationTrace.paramsVersion).toBeDefined();
        expect(line.calculationTrace.paramsVersion).toMatch(/^v\d+\.\d+\.\d+$/);
        expect(line.calculationTrace.decisionReason).toBeDefined();
        expect(line.calculationTrace.decisionReason.length).toBeGreaterThan(0);
        expect(line.calculationTrace.calculatedAt).toBeDefined();
        expect(line.calculationTrace.calculatedBy).toBe('客户经理张三');
      });

      const principalLine = record.lines.find(l => l.lineType === 'PRINCIPAL')!;
      expect(principalLine.calculationTrace.decisionReason).toContain('持有满1年');

      const feeLine = record.lines.find(l => l.lineType === 'FEE')!;
      expect(feeLine.calculationTrace.decisionReason).toContain('持有不满30天');
    });
  });
});
