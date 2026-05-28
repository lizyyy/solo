import { describe, it, expect } from 'vitest';
import type { Artwork, Exhibition, SamplingData } from '@/types';
import {
  calculateCumulativeExposure,
  getExposureRiskLevel
} from '@/hooks/useExposureCalculation';

describe('曝光计算单元测试', () => {
  const mockArtwork: Artwork = {
    id: 'artwork-test-001',
    galleryId: 'gallery-test',
    exhibitionId: 'exhibition-test',
    registrationNo: 'WH-TEST-001',
    name: '测试作品',
    lightResistanceGrade: 'ISO 15426 Grade 1',
    posX: 0,
    posY: 1.5,
    posZ: 0,
    width: 1,
    height: 1,
    protectionLevel: '一级',
    createdBy: 'test-user',
    createdAt: new Date().toISOString()
  };

  const mockExhibition: Exhibition = {
    id: 'exhibition-test',
    name: '测试展览',
    startDate: '2024-03-01',
    endDate: '2024-03-10',
    dailyOpenHours: 8,
    responsiblePerson: '测试责任人',
    status: 'ongoing',
    createdBy: 'test-user',
    createdAt: new Date().toISOString()
  };

  describe('累计曝光计算', () => {
    it('无采样数据时，应使用计算值作为累计曝光', () => {
      const averageIllumination = 50;
      const result = calculateCumulativeExposure(mockArtwork, mockExhibition, averageIllumination);

      const expectedDays = 10;
      const expectedHours = expectedDays * mockExhibition.dailyOpenHours;
      const expectedExposure = averageIllumination * expectedHours;

      expect(result.totalExposure).toBe(expectedExposure);
      expect(result.calculatedExposure).toBe(expectedExposure);
      expect(result.actualExposure).toBe(expectedExposure);
      expect(result.leakageDays).toHaveLength(0);
      expect(result.exposureByDay).toHaveLength(expectedDays);
    });

    it('有采样数据时，应使用实际采样数据计算累计曝光', () => {
      const averageIllumination = 50;
      const samplingData: SamplingData[] = [
        {
          id: 'sd-1',
          samplingPointId: 'sp-1',
          measuredValue: 52,
          measuredAt: '2024-03-01T10:00:00Z',
          instrumentId: 'INS-001',
          instrumentCalibrationStatus: 'valid',
          measuredBy: 'test-user'
        },
        {
          id: 'sd-2',
          samplingPointId: 'sp-1',
          measuredValue: 48,
          measuredAt: '2024-03-01T14:00:00Z',
          instrumentId: 'INS-001',
          instrumentCalibrationStatus: 'valid',
          measuredBy: 'test-user'
        }
      ];

      const result = calculateCumulativeExposure(mockArtwork, mockExhibition, averageIllumination, samplingData);

      const dailyAverage = (52 + 48) / 2;
      const expectedDailyExposure = dailyAverage * mockExhibition.dailyOpenHours;

      expect(result.actualExposure).toBe(expectedDailyExposure);
      expect(result.totalExposure).toBeGreaterThanOrEqual(result.calculatedExposure);
      expect(result.exposureByDay).toHaveLength(1);
      expect(result.exposureByDay[0].exposure).toBe(expectedDailyExposure);
    });

    it('累计曝光应取计算值和实际值中的较大值', () => {
      const averageIllumination = 100;
      const samplingData: SamplingData[] = [
        {
          id: 'sd-1',
          samplingPointId: 'sp-1',
          measuredValue: 30,
          measuredAt: '2024-03-01T10:00:00Z',
          instrumentId: 'INS-001',
          instrumentCalibrationStatus: 'valid',
          measuredBy: 'test-user'
        }
      ];

      const result = calculateCumulativeExposure(mockArtwork, mockExhibition, averageIllumination, samplingData);

      const calculatedExposure = 100 * 10 * 8;
      expect(result.totalExposure).toBe(calculatedExposure);
      expect(result.totalExposure).toBeGreaterThan(result.actualExposure);
    });

    it('每日曝光数据应正确分组', () => {
      const averageIllumination = 50;
      const samplingData: SamplingData[] = [
        {
          id: 'sd-1',
          samplingPointId: 'sp-1',
          measuredValue: 50,
          measuredAt: '2024-03-01T10:00:00Z',
          instrumentId: 'INS-001',
          instrumentCalibrationStatus: 'valid',
          measuredBy: 'test-user'
        },
        {
          id: 'sd-2',
          samplingPointId: 'sp-1',
          measuredValue: 55,
          measuredAt: '2024-03-02T10:00:00Z',
          instrumentId: 'INS-001',
          instrumentCalibrationStatus: 'valid',
          measuredBy: 'test-user'
        },
        {
          id: 'sd-3',
          samplingPointId: 'sp-1',
          measuredValue: 45,
          measuredAt: '2024-03-02T14:00:00Z',
          instrumentId: 'INS-001',
          instrumentCalibrationStatus: 'valid',
          measuredBy: 'test-user'
        }
      ];

      const result = calculateCumulativeExposure(mockArtwork, mockExhibition, averageIllumination, samplingData);

      expect(result.exposureByDay).toHaveLength(2);

      const day1 = result.exposureByDay.find(d => d.date === '2024-03-01');
      const day2 = result.exposureByDay.find(d => d.date === '2024-03-02');

      expect(day1?.exposure).toBe(50 * 8);
      expect(day2?.exposure).toBe((55 + 45) / 2 * 8);
    });

    it('展览天数计算应包含起止日期', () => {
      const averageIllumination = 50;
      const result = calculateCumulativeExposure(mockArtwork, mockExhibition, averageIllumination);

      expect(result.exposureByDay[0].date).toBe('2024-03-01');
      expect(result.exposureByDay[result.exposureByDay.length - 1].date).toBe('2024-03-10');
    });
  });

  describe('漏算日期检测', () => {
    it('采样数据完整时，漏算日期应为空', () => {
      const averageIllumination = 50;
      const samplingData: SamplingData[] = [];

      for (let day = 1; day <= 10; day++) {
        const dateStr = `2024-03-${day.toString().padStart(2, '0')}`;
        samplingData.push({
          id: `sd-${day}`,
          samplingPointId: 'sp-1',
          measuredValue: 50,
          measuredAt: `${dateStr}T10:00:00Z`,
          instrumentId: 'INS-001',
          instrumentCalibrationStatus: 'valid',
          measuredBy: 'test-user'
        });
      }

      const result = calculateCumulativeExposure(mockArtwork, mockExhibition, averageIllumination, samplingData);

      expect(result.leakageDays).toHaveLength(0);
    });

    it('存在缺失日期时，应正确识别漏算日期', () => {
      const averageIllumination = 50;
      const samplingData: SamplingData[] = [];

      for (let day = 1; day <= 10; day++) {
        if (day === 5 || day === 6) continue;
        const dateStr = `2024-03-${day.toString().padStart(2, '0')}`;
        samplingData.push({
          id: `sd-${day}`,
          samplingPointId: 'sp-1',
          measuredValue: 50,
          measuredAt: `${dateStr}T10:00:00Z`,
          instrumentId: 'INS-001',
          instrumentCalibrationStatus: 'valid',
          measuredBy: 'test-user'
        });
      }

      const result = calculateCumulativeExposure(mockArtwork, mockExhibition, averageIllumination, samplingData);

      expect(result.leakageDays).toHaveLength(2);
      expect(result.leakageDays).toContain('2024-03-05');
      expect(result.leakageDays).toContain('2024-03-06');
    });

    it('完全无采样数据时，应返回所有展览日期为漏算日期', () => {
      const averageIllumination = 50;
      const samplingData: SamplingData[] = [
        {
          id: 'sd-1',
          samplingPointId: 'sp-1',
          measuredValue: 50,
          measuredAt: '2024-03-15T10:00:00Z',
          instrumentId: 'INS-001',
          instrumentCalibrationStatus: 'valid',
          measuredBy: 'test-user'
        }
      ];

      const result = calculateCumulativeExposure(mockArtwork, mockExhibition, averageIllumination, samplingData);

      expect(result.leakageDays).toHaveLength(10);
    });

    it('单日多次采样应计为有效日期', () => {
      const averageIllumination = 50;
      const samplingData: SamplingData[] = [
        {
          id: 'sd-1',
          samplingPointId: 'sp-1',
          measuredValue: 50,
          measuredAt: '2024-03-01T09:00:00Z',
          instrumentId: 'INS-001',
          instrumentCalibrationStatus: 'valid',
          measuredBy: 'test-user'
        },
        {
          id: 'sd-2',
          samplingPointId: 'sp-1',
          measuredValue: 52,
          measuredAt: '2024-03-01T14:00:00Z',
          instrumentId: 'INS-001',
          instrumentCalibrationStatus: 'valid',
          measuredBy: 'test-user'
        }
      ];

      const result = calculateCumulativeExposure(mockArtwork, mockExhibition, averageIllumination, samplingData);

      expect(result.leakageDays).not.toContain('2024-03-01');
    });
  });

  describe('采样数据积分', () => {
    it('单日多次采样应取平均值计算曝光', () => {
      const averageIllumination = 50;
      const samplingData: SamplingData[] = [
        {
          id: 'sd-1',
          samplingPointId: 'sp-1',
          measuredValue: 40,
          measuredAt: '2024-03-01T09:00:00Z',
          instrumentId: 'INS-001',
          instrumentCalibrationStatus: 'valid',
          measuredBy: 'test-user'
        },
        {
          id: 'sd-2',
          samplingPointId: 'sp-1',
          measuredValue: 60,
          measuredAt: '2024-03-01T12:00:00Z',
          instrumentId: 'INS-001',
          instrumentCalibrationStatus: 'valid',
          measuredBy: 'test-user'
        },
        {
          id: 'sd-3',
          samplingPointId: 'sp-1',
          measuredValue: 50,
          measuredAt: '2024-03-01T15:00:00Z',
          instrumentId: 'INS-001',
          instrumentCalibrationStatus: 'valid',
          measuredBy: 'test-user'
        }
      ];

      const result = calculateCumulativeExposure(mockArtwork, mockExhibition, averageIllumination, samplingData);

      const dailyAverage = (40 + 60 + 50) / 3;
      const expectedExposure = dailyAverage * mockExhibition.dailyOpenHours;

      expect(result.actualExposure).toBe(expectedExposure);
    });

    it('多日采样数据应分别计算每日曝光后累加', () => {
      const averageIllumination = 50;
      const samplingData: SamplingData[] = [
        {
          id: 'sd-1',
          samplingPointId: 'sp-1',
          measuredValue: 50,
          measuredAt: '2024-03-01T10:00:00Z',
          instrumentId: 'INS-001',
          instrumentCalibrationStatus: 'valid',
          measuredBy: 'test-user'
        },
        {
          id: 'sd-2',
          samplingPointId: 'sp-1',
          measuredValue: 60,
          measuredAt: '2024-03-02T10:00:00Z',
          instrumentId: 'INS-001',
          instrumentCalibrationStatus: 'valid',
          measuredBy: 'test-user'
        }
      ];

      const result = calculateCumulativeExposure(mockArtwork, mockExhibition, averageIllumination, samplingData);

      const expectedExposure = (50 + 60) * mockExhibition.dailyOpenHours;
      expect(result.actualExposure).toBe(expectedExposure);
    });

    it('采样数据积分应乘以每日开放时长', () => {
      const exhibitionLongHours: Exhibition = {
        ...mockExhibition,
        dailyOpenHours: 12
      };

      const averageIllumination = 50;
      const samplingData: SamplingData[] = [
        {
          id: 'sd-1',
          samplingPointId: 'sp-1',
          measuredValue: 50,
          measuredAt: '2024-03-01T10:00:00Z',
          instrumentId: 'INS-001',
          instrumentCalibrationStatus: 'valid',
          measuredBy: 'test-user'
        }
      ];

      const result = calculateCumulativeExposure(mockArtwork, exhibitionLongHours, averageIllumination, samplingData);

      expect(result.actualExposure).toBe(50 * 12);
    });

    it('无采样数据时，采样数据积分应退化为计算值', () => {
      const averageIllumination = 50;
      const result = calculateCumulativeExposure(mockArtwork, mockExhibition, averageIllumination);

      expect(result.actualExposure).toBe(result.calculatedExposure);
    });
  });

  describe('曝光风险等级计算', () => {
    it('低曝光量应返回低风险等级', () => {
      const exhibition: Exhibition = {
        ...mockExhibition,
        startDate: '2024-03-01',
        endDate: '2024-03-31'
      };

      const totalExposure = 2000;
      const result = getExposureRiskLevel(totalExposure, exhibition);

      expect(result.riskLevel).toBe('low');
      expect(result.remainingExposure).toBeGreaterThanOrEqual(0);
      expect(result.daysRemaining).toBeGreaterThanOrEqual(0);
    });

    it('中曝光量应返回中风险等级', () => {
      const exhibition: Exhibition = {
        ...mockExhibition,
        startDate: '2024-03-01',
        endDate: '2024-03-31'
      };

      const totalExposure = 3000;
      const result = getExposureRiskLevel(totalExposure, exhibition);

      expect(result.riskLevel).toBe('medium');
    });

    it('高曝光量应返回高风险等级', () => {
      const exhibition: Exhibition = {
        ...mockExhibition,
        startDate: '2024-03-01',
        endDate: '2024-03-31'
      };

      const totalExposure = 4000;
      const result = getExposureRiskLevel(totalExposure, exhibition);

      expect(result.riskLevel).toBe('high');
    });

    it('超量曝光应返回严重风险等级', () => {
      const exhibition: Exhibition = {
        ...mockExhibition,
        startDate: '2024-03-01',
        endDate: '2024-03-31'
      };

      const totalExposure = 5000;
      const result = getExposureRiskLevel(totalExposure, exhibition);

      expect(result.riskLevel).toBe('critical');
    });

    it('剩余天数计算应正确', () => {
      const futureExhibition: Exhibition = {
        ...mockExhibition,
        startDate: '2024-03-01',
        endDate: '2099-12-31'
      };

      const result = getExposureRiskLevel(1000, futureExhibition);
      expect(result.daysRemaining).toBeGreaterThan(0);
    });
  });
});
