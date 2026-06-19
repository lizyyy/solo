import { calculateFitting, predict, formatEquation } from '../algorithms/fitting';
import { createSample } from '../models/factories';
import type { SampleSource } from '../models/types';

const mockSource: SampleSource = {
  studentId: 'S001',
  draftId: 'D001',
  fileName: 'test.docx',
  uploadedAt: Date.now(),
  uploader: 'test',
};

describe('曲线拟合算法', () => {
  describe('线性拟合', () => {
    it('应该正确拟合线性数据 y = 2x + 1', () => {
      const samples = [
        createSample(1, 3, mockSource),
        createSample(2, 5, mockSource),
        createSample(3, 7, mockSource),
        createSample(4, 9, mockSource),
        createSample(5, 11, mockSource),
      ];

      const result = calculateFitting(samples, 'linear', 'test');
      
      expect(result.params.rSquared).toBeGreaterThan(0.99);
      expect(Math.abs(result.params.coefficients[0] - 1)).toBeLessThan(0.01);
      expect(Math.abs(result.params.coefficients[1] - 2)).toBeLessThan(0.01);
    });

    it('预测函数应该正确计算', () => {
      const coefficients = [1, 2];
      expect(predict(3, coefficients, 'linear')).toBe(7);
      expect(predict(0, coefficients, 'linear')).toBe(1);
    });

    it('方程格式化应该正确', () => {
      const coefficients = [1.5, 2.333];
      expect(formatEquation(coefficients, 'linear')).toBe('y = 2.3330x + 1.5000');
    });
  });

  describe('多项式拟合', () => {
    it('应该正确拟合二次多项式 y = x²', () => {
      const samples = [
        createSample(0, 0, mockSource),
        createSample(1, 1, mockSource),
        createSample(2, 4, mockSource),
        createSample(3, 9, mockSource),
        createSample(4, 16, mockSource),
      ];

      const result = calculateFitting(samples, 'polynomial', 'test', true, 2);
      
      expect(result.params.rSquared).toBeGreaterThan(0.99);
      expect(Math.abs(result.params.coefficients[0])).toBeLessThan(0.01);
      expect(Math.abs(result.params.coefficients[1])).toBeLessThan(0.01);
      expect(Math.abs(result.params.coefficients[2] - 1)).toBeLessThan(0.01);
    });

    it('应该拒绝无效的阶数', () => {
      const samples = [createSample(1, 2, mockSource), createSample(2, 4, mockSource)];
      expect(() => calculateFitting(samples, 'polynomial', 'test', true, 0)).toThrow();
    });
  });

  describe('指数拟合', () => {
    it('应该正确拟合指数数据 y = 2 * e^(0.5x)', () => {
      const samples = [
        createSample(0, 2, mockSource),
        createSample(1, 3.297, mockSource),
        createSample(2, 5.437, mockSource),
        createSample(3, 8.963, mockSource),
        createSample(4, 14.778, mockSource),
      ];

      const result = calculateFitting(samples, 'exponential', 'test');
      
      expect(result.params.rSquared).toBeGreaterThan(0.99);
      expect(Math.abs(result.params.coefficients[0] - 2)).toBeLessThan(0.1);
      expect(Math.abs(result.params.coefficients[1] - 0.5)).toBeLessThan(0.01);
    });

    it('应该拒绝Y值小于等于0的数据', () => {
      const samples = [createSample(1, -1, mockSource), createSample(2, 4, mockSource)];
      expect(() => calculateFitting(samples, 'exponential', 'test')).toThrow();
    });
  });

  describe('对数拟合', () => {
    it('应该正确拟合对数数据 y = 1 + 2*ln(x)', () => {
      const samples = [
        createSample(1, 1, mockSource),
        createSample(2, 2.386, mockSource),
        createSample(3, 3.197, mockSource),
        createSample(4, 3.773, mockSource),
        createSample(5, 4.219, mockSource),
      ];

      const result = calculateFitting(samples, 'logarithmic', 'test');
      
      expect(result.params.rSquared).toBeGreaterThan(0.99);
      expect(Math.abs(result.params.coefficients[0] - 1)).toBeLessThan(0.01);
      expect(Math.abs(result.params.coefficients[1] - 2)).toBeLessThan(0.01);
    });

    it('应该拒绝X值小于等于0的数据', () => {
      const samples = [createSample(-1, 2, mockSource), createSample(2, 4, mockSource)];
      expect(() => calculateFitting(samples, 'logarithmic', 'test')).toThrow();
    });
  });

  describe('样本过滤', () => {
    it('应该排除已撤回的样本', () => {
      const samples = [
        createSample(1, 3, mockSource),
        createSample(2, 5, mockSource),
        createSample(3, 7, mockSource),
      ];
      samples[1].status = 'withdrawn';
      samples[1].withdrawnReason = 'test';

      const result = calculateFitting(samples, 'linear', 'test');
      
      expect(result.params.sampleIds).not.toContain(samples[1].id);
      expect(result.params.excludedSampleIds).toContain(samples[1].id);
      expect(result.params.sampleIds.length).toBe(2);
    });

    it('样本数不足时应该抛出错误', () => {
      const samples = [createSample(1, 2, mockSource)];
      expect(() => calculateFitting(samples, 'linear', 'test')).toThrow();
    });
  });

  describe('预测值生成', () => {
    it('应该生成100个以上的预测点', () => {
      const samples = [
        createSample(1, 3, mockSource),
        createSample(2, 5, mockSource),
        createSample(3, 7, mockSource),
        createSample(4, 9, mockSource),
        createSample(5, 11, mockSource),
      ];

      const result = calculateFitting(samples, 'linear', 'test');
      
      expect(result.predictedValues.length).toBeGreaterThanOrEqual(100);
      expect(result.predictedValues[0].x).toBeLessThanOrEqual(1);
      expect(result.predictedValues[result.predictedValues.length - 1].x).toBeGreaterThanOrEqual(5);
    });

    it('残差应该正确计算', () => {
      const samples = [
        createSample(1, 3, mockSource),
        createSample(2, 5, mockSource),
      ];

      const result = calculateFitting(samples, 'linear', 'test');
      
      expect(result.residuals.length).toBe(2);
      expect(Math.abs(result.residuals[0].residual)).toBeLessThan(0.01);
    });
  });
});
