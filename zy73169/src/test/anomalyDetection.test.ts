import { detectDuplicates, detectBoundarySamples, detectOutliers, detectAllAnomalies, getAnomalySummary, isolateAnomalousSamples, clearDetectionAnomalies } from '../algorithms/anomalyDetection';
import { createSample } from '../models/factories';
import type { SampleSource } from '../models/types';

const mockSource: SampleSource = {
  studentId: 'S001',
  draftId: 'D001',
  fileName: 'test.docx',
  uploadedAt: Date.now(),
  uploader: 'test',
};

describe('异常检测算法', () => {
  describe('重复样本检测', () => {
    it('应该检测到完全重复的样本', () => {
      const samples = [
        createSample(1, 2, mockSource),
        createSample(1, 2, mockSource),
        createSample(2, 4, mockSource),
      ];

      const anomalies = detectDuplicates(samples);

      expect(anomalies.length).toBe(2);
      expect(anomalies[0].type).toBe('duplicate');
      expect(anomalies[0].severity).toBe('high');
      expect(samples[0].anomalies.length).toBe(1);
      expect(samples[1].anomalies.length).toBe(1);
      expect(samples[2].anomalies.length).toBe(0);
    });

    it('应该在容差范围内检测重复', () => {
      const samples = [
        createSample(1.0000001, 2.0000001, mockSource),
        createSample(1.0000002, 2.0000002, mockSource),
        createSample(2, 4, mockSource),
      ];

      const anomalies = detectDuplicates(samples, 1e-6);

      expect(anomalies.length).toBe(2);
    });

    it('不应该检测容差范围外的重复', () => {
      const samples = [
        createSample(1, 2, mockSource),
        createSample(1.001, 2.001, mockSource),
        createSample(2, 4, mockSource),
      ];

      const anomalies = detectDuplicates(samples, 1e-6);

      expect(anomalies.length).toBe(0);
    });

    it('不应该检测已撤回的样本', () => {
      const samples = [
        createSample(1, 2, mockSource),
        createSample(1, 2, mockSource),
        createSample(2, 4, mockSource),
      ];
      samples[1].status = 'withdrawn';

      const anomalies = detectDuplicates(samples);

      expect(anomalies.length).toBe(0);
    });

    it('应该记录相关的样本ID', () => {
      const samples = [
        createSample(1, 2, mockSource),
        createSample(1, 2, mockSource),
      ];

      const anomalies = detectDuplicates(samples);

      expect(anomalies[0].relatedSampleIds).toHaveLength(2);
      expect(anomalies[0].relatedSampleIds).toContain(samples[0].id);
      expect(anomalies[0].relatedSampleIds).toContain(samples[1].id);
    });
  });

  describe('边界样本检测', () => {
    it('样本量不足时应该全部标记为边界', () => {
      const samples = [
        createSample(1, 2, mockSource),
        createSample(2, 4, mockSource),
        createSample(3, 6, mockSource),
      ];

      const anomalies = detectBoundarySamples(samples, 0.1, 5);

      expect(anomalies.length).toBe(3);
      expect(anomalies[0].type).toBe('boundary');
      expect(anomalies[0].severity).toBe('medium');
      expect(anomalies[0].description).toContain('样本量不足');
    });

    it('样本量充足时应该标记两端10%的样本', () => {
      const samples = [];
      for (let i = 1; i <= 10; i++) {
        samples.push(createSample(i, i * 2, mockSource));
      }

      const anomalies = detectBoundarySamples(samples, 0.1, 5);

      expect(anomalies.length).toBe(2);
      expect(anomalies.some(a => a.description.includes('低端'))).toBe(true);
      expect(anomalies.some(a => a.description.includes('高端'))).toBe(true);
      expect(anomalies[0].severity).toBe('low');
    });

    it('不应该检测已撤回的样本', () => {
      const samples = [
        createSample(1, 2, mockSource),
        createSample(2, 4, mockSource),
        createSample(3, 6, mockSource),
      ];
      samples[0].status = 'withdrawn';

      const anomalies = detectBoundarySamples(samples, 0.1, 5);

      expect(anomalies.length).toBe(2);
    });
  });

  describe('离群值检测', () => {
    it('应该检测到明显的离群值', () => {
      const samples = [
        createSample(1, 2, mockSource),
        createSample(2, 4, mockSource),
        createSample(3, 6, mockSource),
        createSample(4, 8, mockSource),
        createSample(5, 100, mockSource),
        createSample(6, 12, mockSource),
        createSample(7, 14, mockSource),
      ];

      const anomalies = detectOutliers(samples, 1.5);

      expect(anomalies.length).toBe(1);
      expect(anomalies[0].type).toBe('outlier');
      expect(anomalies[0].severity).toBe('high');
      expect(anomalies[0].description).toContain('偏高');
    });

    it('样本量不足时不进行检测', () => {
      const samples = [
        createSample(1, 2, mockSource),
        createSample(2, 4, mockSource),
        createSample(100, 200, mockSource),
      ];

      const anomalies = detectOutliers(samples);

      expect(anomalies.length).toBe(0);
    });

    it('应该检测偏低的离群值', () => {
      const samples = [
        createSample(1, -100, mockSource),
        createSample(2, 4, mockSource),
        createSample(3, 6, mockSource),
        createSample(4, 8, mockSource),
        createSample(5, 10, mockSource),
        createSample(6, 12, mockSource),
        createSample(7, 14, mockSource),
      ];

      const anomalies = detectOutliers(samples, 1.5);

      expect(anomalies.length).toBe(1);
      expect(anomalies[0].description).toContain('偏低');
    });
  });

  describe('综合异常检测', () => {
    it('应该检测所有类型的异常', () => {
      const samples = [
        createSample(1, 2, mockSource),
        createSample(1, 2, mockSource),
        createSample(2, 4, mockSource),
        createSample(3, 6, mockSource),
        createSample(4, 8, mockSource),
        createSample(5, 100, mockSource),
        createSample(6, 12, mockSource),
      ];

      const anomalies = detectAllAnomalies(samples);

      const types = new Set(anomalies.map(a => a.type));
      expect(types.has('duplicate')).toBe(true);
      expect(types.has('outlier')).toBe(true);
      expect(types.has('boundary')).toBe(true);
    });

    it('应该标记已撤回的样本', () => {
      const samples = [
        createSample(1, 2, mockSource),
        createSample(2, 4, mockSource),
        createSample(3, 6, mockSource),
        createSample(4, 8, mockSource),
        createSample(5, 10, mockSource),
        createSample(6, 12, mockSource),
      ];
      samples[2].status = 'withdrawn';
      samples[2].withdrawnReason = '数据错误';

      const anomalies = detectAllAnomalies(samples);

      const withdrawnAnomalies = anomalies.filter(a => a.type === 'withdrawn');
      expect(withdrawnAnomalies.length).toBe(1);
      expect(withdrawnAnomalies[0].description).toContain('数据错误');
    });
  });

  describe('异常统计', () => {
    it('应该正确统计各类异常数量', () => {
      const samples = [
        createSample(1, 2, mockSource),
        createSample(1, 2, mockSource),
        createSample(2, 4, mockSource),
        createSample(3, 100, mockSource),
        createSample(4, 8, mockSource),
        createSample(5, 10, mockSource),
        createSample(6, 12, mockSource),
      ];
      samples[5].status = 'withdrawn';
      samples[5].withdrawnReason = 'test';

      detectAllAnomalies(samples);
      const summary = getAnomalySummary(samples);

      expect(summary.duplicate).toBe(1);
      expect(summary.outlier).toBe(1);
      expect(summary.boundary).toBeGreaterThanOrEqual(1);
      expect(summary.withdrawn).toBe(1);
      expect(summary.total).toBeGreaterThanOrEqual(4);
    });

    it('应该去重统计相同的异常', () => {
      const samples = [
        createSample(1, 2, mockSource),
        createSample(1, 2, mockSource),
      ];

      detectDuplicates(samples);
      const summary = getAnomalySummary(samples);

      expect(summary.duplicate).toBe(1);
      expect(summary.total).toBe(1);
    });

    it('重算前应该清理旧的duplicate/outlier/boundary标记', () => {
      const samples = [
        createSample(1, 2, mockSource),
        createSample(1, 2, mockSource),
        createSample(2, 4, mockSource),
        createSample(3, 100, mockSource),
        createSample(4, 8, mockSource),
      ];

      detectAllAnomalies(samples);
      const summary1 = getAnomalySummary(samples);
      const duplicateCount1 = samples.filter(s => s.anomalies.some(a => a.type === 'duplicate')).length;
      const outlierCount1 = samples.filter(s => s.anomalies.some(a => a.type === 'outlier')).length;

      expect(duplicateCount1).toBe(2);
      expect(outlierCount1).toBe(1);
      expect(summary1.duplicate).toBe(1);
      expect(summary1.outlier).toBe(1);

      detectAllAnomalies(samples);
      const summary2 = getAnomalySummary(samples);
      const duplicateCount2 = samples.filter(s => s.anomalies.some(a => a.type === 'duplicate')).length;
      const outlierCount2 = samples.filter(s => s.anomalies.some(a => a.type === 'outlier')).length;

      expect(duplicateCount2).toBe(2);
      expect(outlierCount2).toBe(1);
      expect(summary2.duplicate).toBe(1);
      expect(summary2.outlier).toBe(1);

      samples[0].anomalies.forEach(a => {
        if (a.type === 'duplicate') a.resolved = true;
      });
      detectAllAnomalies(samples);
      const summary3 = getAnomalySummary(samples);
      expect(summary3.duplicate).toBe(1);
    });

    it('应该保留撤回和已解决的异常标记', () => {
      const samples = [
        createSample(1, 2, mockSource),
        createSample(1, 2, mockSource),
        createSample(2, 4, mockSource),
      ];
      samples[2].status = 'withdrawn';
      samples[2].withdrawnReason = '数据错误';

      detectAllAnomalies(samples);
      samples[0].anomalies.forEach(a => {
        if (a.type === 'duplicate') {
          a.resolved = true;
          a.resolvedBy = '测试用户';
        }
      });

      const withdrawnBefore = samples[2].anomalies.filter(a => a.type === 'withdrawn').length;
      const resolvedBefore = samples[0].anomalies.filter(a => a.resolved).length;

      clearDetectionAnomalies(samples);

      const withdrawnAfter = samples[2].anomalies.filter(a => a.type === 'withdrawn').length;
      const resolvedAfter = samples[0].anomalies.filter(a => a.resolved).length;

      expect(withdrawnBefore).toBe(1);
      expect(withdrawnAfter).toBe(1);
      expect(resolvedBefore).toBeGreaterThanOrEqual(1);
      expect(resolvedAfter).toBe(resolvedBefore);
    });
  });

  describe('异常样本隔离', () => {
    it('应该正确隔离高风险异常样本', () => {
      const samples = [
        createSample(1, 2, mockSource),
        createSample(1, 2, mockSource),
        createSample(2, 4, mockSource),
        createSample(3, 6, mockSource),
      ];
      samples[3].status = 'withdrawn';

      detectAllAnomalies(samples);
      const { normal, anomalous } = isolateAnomalousSamples(samples);

      expect(normal.length).toBe(1);
      expect(anomalous.length).toBe(3);
      expect(anomalous.map(s => s.id)).toContain(samples[0].id);
      expect(anomalous.map(s => s.id)).toContain(samples[1].id);
      expect(anomalous.map(s => s.id)).toContain(samples[3].id);
    });

    it('不应该隔离已解决的高风险异常', () => {
      const samples = [
        createSample(1, 2, mockSource),
        createSample(1, 2, mockSource),
        createSample(2, 4, mockSource),
      ];

      detectAllAnomalies(samples);
      samples.forEach(s => {
        s.anomalies.forEach(a => {
          if (a.severity === 'high') {
            a.resolved = true;
            a.resolvedAt = Date.now();
            a.resolvedBy = 'test';
          }
        });
      });

      const { normal, anomalous } = isolateAnomalousSamples(samples);

      expect(normal.length).toBe(3);
      expect(anomalous.length).toBe(0);
    });
  });
});
