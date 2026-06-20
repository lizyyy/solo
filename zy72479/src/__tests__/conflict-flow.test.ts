import { describe, it, expect, beforeEach } from 'vitest';
import { useCaseStore } from '../store/useCaseStore';
import { resultTypeLabels } from '../types';

const CASE_ID = 'case-004';
const CONFLICT_ID = 'conflict-001';

describe('冲突流程端到端测试', () => {
  beforeEach(() => {
    useCaseStore.getState().resetToInitialData();
  });

  describe('确认采信路径', () => {
    it('完整走通确认采信流程并验证各环节结果', () => {
      const store = useCaseStore.getState();

      store.simulateStep1ImportRoadPhoto(CASE_ID);
      store.simulateStep2ReviewBusCard(CASE_ID);

      store.updateConflictStatus(CONFLICT_ID, 'confirmed', '小姜');
      store.simulateStep3ConflictReview(CASE_ID);

      const state = useCaseStore.getState();
      const caseItem = state.getCaseById(CASE_ID);
      const historyLogs = state.getHistoryByCaseId(CASE_ID);
      const report = state.generateReport(CASE_ID);

      expect(caseItem?.resultType).not.toBe('smooth');
      expect(caseItem?.resultType).toBe('conflict_confirmed');
      expect(resultTypeLabels[caseItem!.resultType]).toBe('冲突已确认采信');

      expect(caseItem?.finalConclusion).toContain('时段性差异');
      expect(caseItem?.finalConclusion).not.toContain('已形成完整证据链');

      const confirmLog = historyLogs.find(l => l.action === '冲突复核-已确认采信');
      expect(confirmLog).toBeDefined();
      expect(confirmLog!.operator).toBe('小姜');

      const statusLog = historyLogs.find(l => l.action === '更新案件状态-冲突已确认');
      expect(statusLog).toBeDefined();

      expect(report).toContain('冲突已确认采信');
      expect(report).toContain('已确认采信');
    });
  });

  describe('驳回补充路径', () => {
    it('完整走通驳回流程并验证各环节结果', () => {
      const store = useCaseStore.getState();

      store.simulateStep1ImportRoadPhoto(CASE_ID);
      store.simulateStep2ReviewBusCard(CASE_ID);

      store.updateConflictStatus(CONFLICT_ID, 'rejected', '小姜');
      store.simulateStep3ConflictReview(CASE_ID);

      const state = useCaseStore.getState();
      const caseItem = state.getCaseById(CASE_ID);
      const historyLogs = state.getHistoryByCaseId(CASE_ID);
      const report = state.generateReport(CASE_ID);

      expect(caseItem?.resultType).not.toBe('summary_only');
      expect(caseItem?.resultType).toBe('conflict_rejected');
      expect(resultTypeLabels[caseItem!.resultType]).toBe('冲突已驳回待补');

      expect(caseItem?.finalConclusion).toContain('冲突');
      expect(caseItem?.finalConclusion).toContain('驳回');
      expect(caseItem?.finalConclusion).not.toContain('居民汇总');
      expect(caseItem?.finalConclusion).not.toContain('居民意见仅汇总');

      const rejectLog = historyLogs.find(l => l.action === '冲突复核-已驳回');
      expect(rejectLog).toBeDefined();
      expect(rejectLog!.operator).toBe('小姜');

      const statusLog = historyLogs.find(l => l.action === '更新案件状态-冲突已驳回待补');
      expect(statusLog).toBeDefined();

      expect(report).toContain('照片');
      expect(report).toContain('公交刷卡');
      expect(report).not.toContain('居民缺失');
    });
  });
});
