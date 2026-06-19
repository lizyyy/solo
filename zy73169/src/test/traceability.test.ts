import {
  updateSampleField,
  confirmSample,
  withdrawSample,
  addSample,
  getSampleChangeHistory,
  getSampleSourceInfo,
  getConfirmationDiffs,
  recalculateWithWithdrawn,
  verifyCalibrationConsistency,
} from '../services/traceability';
import { createFittingSession, createSample } from '../models/factories';
import type { SampleSource } from '../models/types';
import { calculateFitting } from '../algorithms/fitting';

const mockSource: SampleSource = {
  studentId: 'S001',
  draftId: 'D001',
  fileName: '实验报告-张三.docx',
  uploadedAt: Date.now(),
  uploader: '阿宁',
  originalLine: 5,
  notes: '第一组实验数据',
};

describe('数据溯源与变更管理', () => {
  let session: ReturnType<typeof createFittingSession>;

  beforeEach(() => {
    session = createFittingSession('测试会话', '测试用户');
  });

  describe('样本更新', () => {
    it('应该更新样本字段并记录变更历史', () => {
      const sample = createSample(1, 2, mockSource);
      session.samples.push(sample);

      const result = updateSampleField(session, sample.id, 'y', 2.5, '阿宁', '修正录入错误');

      expect(result).not.toBeNull();
      expect(result!.y).toBe(2.5);
      expect(session.changeHistory.length).toBe(1);
      expect(session.changeHistory[0].field).toBe('y');
      expect(session.changeHistory[0].oldValue).toBe(2);
      expect(session.changeHistory[0].newValue).toBe(2.5);
      expect(session.changeHistory[0].changedBy).toBe('阿宁');
      expect(session.changeHistory[0].reason).toBe('修正录入错误');
    });

    it('值未变化时不应该记录变更', () => {
      const sample = createSample(1, 2, mockSource);
      session.samples.push(sample);

      const result = updateSampleField(session, sample.id, 'y', 2, '阿宁');

      expect(result).not.toBeNull();
      expect(session.changeHistory.length).toBe(0);
    });

    it('样本不存在时应该返回null', () => {
      const result = updateSampleField(session, 'non-existent', 'y', 2.5, '阿宁');

      expect(result).toBeNull();
    });
  });

  describe('样本确认', () => {
    it('应该确认样本并更新状态', () => {
      const sample = createSample(1, 2, mockSource);
      session.samples.push(sample);

      const result = confirmSample(session, sample.id, '负责人');

      expect(result).not.toBeNull();
      expect(result!.status).toBe('confirmed');
      expect(result!.confirmedBy).toBe('负责人');
      expect(result!.confirmedAt).toBeDefined();
      expect(session.changeHistory.length).toBe(1);
      expect(session.changeHistory[0].oldValue).toBe('raw');
      expect(session.changeHistory[0].newValue).toBe('confirmed');
    });

    it('应该解决非高风险异常', () => {
      const sample = createSample(1, 2, mockSource);
      sample.anomalies.push({
        id: 'a1',
        type: 'boundary',
        description: '边界样本',
        severity: 'low',
        detectedAt: Date.now(),
        detectedBy: 'system',
        resolved: false,
      });
      session.samples.push(sample);

      confirmSample(session, sample.id, '负责人');

      expect(sample.anomalies[0].resolved).toBe(true);
      expect(sample.anomalies[0].resolvedBy).toBe('负责人');
    });

    it('不应该解决高风险异常', () => {
      const sample = createSample(1, 2, mockSource);
      sample.anomalies.push({
        id: 'a1',
        type: 'duplicate',
        description: '重复样本',
        severity: 'high',
        detectedAt: Date.now(),
        detectedBy: 'system',
        resolved: false,
      });
      session.samples.push(sample);

      confirmSample(session, sample.id, '负责人');

      expect(sample.anomalies[0].resolved).toBe(false);
    });

    it('已经确认的样本不应该重复确认', () => {
      const sample = createSample(1, 2, mockSource);
      sample.status = 'confirmed';
      session.samples.push(sample);

      const result = confirmSample(session, sample.id, '负责人');

      expect(result).not.toBeNull();
      expect(session.changeHistory.length).toBe(0);
    });
  });

  describe('样本撤回', () => {
    it('应该撤回样本并记录原因', () => {
      const sample = createSample(1, 2, mockSource);
      session.samples.push(sample);

      const result = withdrawSample(session, sample.id, '阿宁', '数据录入错误');

      expect(result).not.toBeNull();
      expect(result!.status).toBe('withdrawn');
      expect(result!.withdrawnReason).toBe('数据录入错误');
      expect(result!.withdrawnAt).toBeDefined();
      expect(session.changeHistory.length).toBe(1);
    });

    it('应该自动添加撤回异常标记', () => {
      const sample = createSample(1, 2, mockSource);
      session.samples.push(sample);

      withdrawSample(session, sample.id, '阿宁', '测试撤回');

      expect(sample.anomalies.some(a => a.type === 'withdrawn')).toBe(true);
    });
  });

  describe('添加样本', () => {
    it('应该添加样本并记录创建历史', () => {
      const result = addSample(session, 1, 2, mockSource, '阿宁');

      expect(result).not.toBeNull();
      expect(session.samples.length).toBe(1);
      expect(session.changeHistory.length).toBe(1);
      expect(session.changeHistory[0].field).toBe('created');
    });
  });

  describe('变更历史查询', () => {
    it('应该按时间倒序返回变更历史', async () => {
      const sample = createSample(1, 2, mockSource);
      session.samples.push(sample);

      updateSampleField(session, sample.id, 'y', 3, '阿宁', '第一次修改');
      await new Promise(resolve => setTimeout(resolve, 10));
      updateSampleField(session, sample.id, 'y', 4, '阿宁', '第二次修改');

      const history = getSampleChangeHistory(session, sample.id);

      expect(history.length).toBe(2);
      expect(history[0].reason).toBe('第二次修改');
      expect(history[1].reason).toBe('第一次修改');
    });
  });

  describe('来源信息格式化', () => {
    it('应该正确格式化来源信息', () => {
      const sample = createSample(1, 2, mockSource);
      const info = getSampleSourceInfo(sample);

      expect(info).toContain('学生: S001');
      expect(info).toContain('草稿: D001');
      expect(info).toContain('文件: 实验报告-张三.docx');
      expect(info).toContain('行号: 5');
      expect(info).toContain('备注: 第一组实验数据');
    });

    it('没有行号和备注时应该不显示', () => {
      const source = { ...mockSource, originalLine: undefined, notes: undefined };
      const sample = createSample(1, 2, source);
      const info = getSampleSourceInfo(sample);

      expect(info).not.toContain('行号');
      expect(info).not.toContain('备注');
    });
  });

  describe('确认前后变更对比', () => {
    it('应该返回确认前后的变更对比', async () => {
      const sample = createSample(1, 2, mockSource);
      session.samples.push(sample);

      updateSampleField(session, sample.id, 'y', 3, '阿宁', '修正数据');
      await new Promise(resolve => setTimeout(resolve, 10));
      confirmSample(session, sample.id, '负责人');

      const diffs = getConfirmationDiffs(session, sample.id);

      expect(diffs.length).toBe(2);
      expect(diffs.some(d => d.field === 'y')).toBe(true);
      expect(diffs.some(d => d.field === 'status')).toBe(true);
    });
  });

  describe('撤回复算', () => {
    it('应该对比撤回前后的拟合结果', () => {
      const samples = [
        createSample(1, 3, mockSource),
        createSample(2, 5, mockSource),
        createSample(3, 7, mockSource),
        createSample(4, 9, mockSource),
        createSample(5, 11, mockSource),
      ];
      samples[2].status = 'withdrawn';
      samples[2].withdrawnReason = '数据错误';
      session.samples = samples;

      const result = recalculateWithWithdrawn(session, samples[2].id, 'linear', '测试用户');

      expect(result).not.toBeNull();
      expect(result!.before.params.rSquared).toBeDefined();
      expect(result!.after.params.rSquared).toBeDefined();
      expect(result!.before.params.sampleIds).toContain(samples[2].id);
      expect(result!.after.params.sampleIds).not.toContain(samples[2].id);
    });

    it('非撤回样本应该返回null', () => {
      const sample = createSample(1, 2, mockSource);
      session.samples.push(sample);

      const result = recalculateWithWithdrawn(session, sample.id, 'linear', '测试用户');

      expect(result).toBeNull();
    });
  });

  describe('口径一致性校验', () => {
    it('数据一致时应该返回通过', () => {
      const samples = [
        createSample(1, 3, mockSource),
        createSample(2, 5, mockSource),
        createSample(3, 7, mockSource),
      ];
      session.samples = samples;

      const fittingResult = calculateFitting(samples, 'linear', 'test');
      session.fittingParams.push(fittingResult.params);

      const result = verifyCalibrationConsistency(session, fittingResult.params.id);

      expect(result.consistent).toBe(true);
      expect(result.mismatches.length).toBe(0);
    });
  });
});
