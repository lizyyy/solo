import { describe, it, expect } from 'vitest';
import type { Artwork, LightSource, Wall, Exhibition, SamplingData, Risk } from '@/types';
import { LIGHT_RESISTANCE_THRESHOLDS } from '@/types';
import {
  detectOverIlluminationRisks,
  detectCumulativeLeakRisks,
  detectLightPenetrationRisks,
  detectAllRisks
} from '@/hooks/useRiskDetection';

describe('风险检测单元测试', () => {
  const mockLightSource: LightSource = {
    id: 'light-test-001',
    galleryId: 'gallery-test',
    name: '测试射灯',
    type: 'spot',
    power: 30,
    intensity: 5000,
    posX: 0,
    posY: 3,
    posZ: 0,
    angleX: -90,
    angleY: 0,
    angleZ: 0,
    beamAngle: 30,
    colorTemperature: 3200,
    createdBy: 'test-user',
    createdAt: new Date().toISOString()
  };

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

  const emptyWalls: Wall[] = [];

  describe('照度超限检测', () => {
    it('照度未超限时，不应检测到风险', () => {
      const lowIntensityLight: LightSource = {
        ...mockLightSource,
        intensity: 100
      };

      const risks = detectOverIlluminationRisks([mockArtwork], [lowIntensityLight], emptyWalls);
      expect(risks).toHaveLength(0);
    });

    it('照度超限时，应检测到超限风险', () => {
      const highIntensityLight: LightSource = {
        ...mockLightSource,
        intensity: 10000
      };

      const risks = detectOverIlluminationRisks([mockArtwork], [highIntensityLight], emptyWalls);
      expect(risks).toHaveLength(1);
      expect(risks[0].type).toBe('over_illumination');
      expect(risks[0].artworkId).toBe(mockArtwork.id);
      expect(risks[0].measuredValue).toBeGreaterThan(risks[0].threshold);
    });

    it('不同耐光等级应有不同的超限阈值', () => {
      const grade1Artwork: Artwork = {
        ...mockArtwork,
        id: 'art-grade1',
        lightResistanceGrade: 'ISO 15426 Grade 1'
      };

      const grade4Artwork: Artwork = {
        ...mockArtwork,
        id: 'art-grade4',
        lightResistanceGrade: 'ISO 15426 Grade 4'
      };

      const mediumLight: LightSource = {
        ...mockLightSource,
        intensity: 3000
      };

      const risks = detectOverIlluminationRisks(
        [grade1Artwork, grade4Artwork],
        [mediumLight],
        emptyWalls
      );

      const grade1Risk = risks.find(r => r.artworkId === 'art-grade1');
      const grade4Risk = risks.find(r => r.artworkId === 'art-grade4');

      expect(grade1Risk).toBeDefined();
      expect(grade1Risk?.threshold).toBe(LIGHT_RESISTANCE_THRESHOLDS['ISO 15426 Grade 1'].maxInstantIllumination);

      if (grade4Risk) {
        expect(grade4Risk.threshold).toBe(LIGHT_RESISTANCE_THRESHOLDS['ISO 15426 Grade 4'].maxInstantIllumination);
      }
    });

    it('超限比例影响风险严重程度', () => {
      const slightOverLight: LightSource = {
        ...mockLightSource,
        intensity: 2500
      };

      const severeOverLight: LightSource = {
        ...mockLightSource,
        intensity: 20000
      };

      const slightRisks = detectOverIlluminationRisks([mockArtwork], [slightOverLight], emptyWalls);
      const severeRisks = detectOverIlluminationRisks([mockArtwork], [severeOverLight], emptyWalls);

      expect(slightRisks[0].severity).not.toBe('critical');
      expect(severeRisks[0].severity).toBe('critical');
      expect(severeRisks[0].exceedRatio).toBeGreaterThan(slightRisks[0].exceedRatio);
    });

    it('多个作品应分别检测超限风险', () => {
      const artwork1: Artwork = { ...mockArtwork, id: 'art-1', posX: -1 };
      const artwork2: Artwork = { ...mockArtwork, id: 'art-2', posX: 1 };
      const artwork3: Artwork = {
        ...mockArtwork,
        id: 'art-3',
        posX: 5,
        lightResistanceGrade: 'ISO 15426 Grade 4'
      };

      const risks = detectOverIlluminationRisks(
        [artwork1, artwork2, artwork3],
        [mockLightSource],
        emptyWalls
      );

      expect(risks.length).toBeGreaterThanOrEqual(2);
      expect(risks.filter(r => r.artworkId === 'art-1')).toHaveLength(1);
      expect(risks.filter(r => r.artworkId === 'art-2')).toHaveLength(1);
    });

    it('风险描述应包含作品名称和超限信息', () => {
      const risks = detectOverIlluminationRisks([mockArtwork], [mockLightSource], emptyWalls);

      expect(risks[0].description).toContain(mockArtwork.name);
      expect(risks[0].description).toContain('lux');
      expect(risks[0].description).toMatch(/超限/);
    });
  });

  describe('展期累计漏算检测', () => {
    const generateSamplingData = (startDate: string, days: number, skipDays: number[] = []): SamplingData[] => {
      const data: SamplingData[] = [];
      const baseDate = new Date(startDate);

      for (let i = 0; i < days; i++) {
        if (skipDays.includes(i)) continue;
        const date = new Date(baseDate);
        date.setDate(date.getDate() + i);
        data.push({
          id: `sd-${i}`,
          samplingPointId: 'sp-1',
          measuredValue: 50,
          measuredAt: date.toISOString(),
          instrumentId: 'INS-001',
          instrumentCalibrationStatus: 'valid',
          measuredBy: 'test-user'
        });
      }

      return data;
    };

    it('采样数据完整时，不应检测到漏算风险', () => {
      const samplingData = generateSamplingData('2024-03-01', 10);
      const risks = detectCumulativeLeakRisks([mockArtwork], mockExhibition, samplingData);

      expect(risks).toHaveLength(0);
    });

    it('存在采样数据缺失时，应检测到漏算风险', () => {
      const samplingData = generateSamplingData('2024-03-01', 10, [3, 4, 5]);
      const risks = detectCumulativeLeakRisks([mockArtwork], mockExhibition, samplingData);

      expect(risks).toHaveLength(1);
      expect(risks[0].type).toBe('cumulative_leak');
      expect(risks[0].description).toContain('3');
    });

    it('漏算天数影响风险描述', () => {
      const samplingData1 = generateSamplingData('2024-03-01', 10, [3]);
      const samplingData5 = generateSamplingData('2024-03-01', 10, [3, 4, 5, 6, 7]);

      const risks1 = detectCumulativeLeakRisks([mockArtwork], mockExhibition, samplingData1);
      const risks5 = detectCumulativeLeakRisks([mockArtwork], mockExhibition, samplingData5);

      expect(risks1[0].description).toContain('1');
      expect(risks5[0].description).toContain('5');
    });

    it('累计曝光量接近阈值时应检测到风险', () => {
      const highValueData: SamplingData[] = [];
      const baseDate = new Date('2024-03-01');

      for (let i = 0; i < 8; i++) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() + i);
        highValueData.push({
          id: `sd-${i}`,
          samplingPointId: 'sp-1',
          measuredValue: 1000,
          measuredAt: date.toISOString(),
          instrumentId: 'INS-001',
          instrumentCalibrationStatus: 'valid',
          measuredBy: 'test-user'
        });
      }

      const risks = detectCumulativeLeakRisks([mockArtwork], mockExhibition, highValueData);
      expect(risks).toHaveLength(1);
      expect(risks[0].severity).toBe('high');
    });

    it('证据应包含缺失日期信息', () => {
      const samplingData = generateSamplingData('2024-03-01', 10, [3, 4]);
      const risks = detectCumulativeLeakRisks([mockArtwork], mockExhibition, samplingData);

      expect(risks[0].evidence.notes).toContain('2024-03-04');
      expect(risks[0].evidence.notes).toContain('2024-03-05');
    });

    it('无采样数据时不应检测到风险', () => {
      const risks = detectCumulativeLeakRisks([mockArtwork], mockExhibition, []);
      expect(risks).toHaveLength(0);
    });
  });

  describe('光源穿墙检测', () => {
    const semiTransparentWall: Wall = {
      id: 'wall-semi',
      start: { x: -3, y: 0, z: 2 },
      end: { x: 3, y: 0, z: 2 },
      height: 3,
      thickness: 0.2,
      material: '石膏板',
      opacity: 0.5
    };

    const opaqueWall: Wall = {
      ...semiTransparentWall,
      id: 'wall-opaque',
      opacity: 1
    };

    const penetratingLight: LightSource = {
      ...mockLightSource,
      posX: 0,
      posY: 2,
      posZ: 0,
      angleX: -45,
      angleY: 0,
      intensity: 5000
    };

    it('光线穿透半透明墙体时，应检测到穿透风险', () => {
      const nearbyArtwork: Artwork = {
        ...mockArtwork,
        id: 'art-near',
        posX: 0,
        posY: 1.5,
        posZ: 3.5
      };

      const risks = detectLightPenetrationRisks(
        [penetratingLight],
        [semiTransparentWall],
        10,
        10,
        [nearbyArtwork]
      );

      expect(risks).toHaveLength(1);
      expect(risks[0].type).toBe('light_penetration');
      expect(risks[0].severity).toBe('critical');
      expect(risks[0].lightSourceId).toBe(penetratingLight.id);
      expect(risks[0].lightSourceId).toBeDefined();
    });

    it('不透明墙体不应检测到穿透风险', () => {
      const risks = detectLightPenetrationRisks(
        [penetratingLight],
        [opaqueWall],
        10,
        10,
        [mockArtwork]
      );

      expect(risks).toHaveLength(0);
    });

    it('光线方向不指向墙体时，无穿透风险', () => {
      const downwardLight: LightSource = {
        ...penetratingLight,
        angleX: -90
      };

      const risks = detectLightPenetrationRisks(
        [downwardLight],
        [semiTransparentWall],
        10,
        10,
        [mockArtwork]
      );

      expect(risks).toHaveLength(0);
    });

    it('穿透风险应包含受影响的作品信息', () => {
      const nearbyArtwork: Artwork = {
        ...mockArtwork,
        id: 'art-near',
        name: '受影响作品',
        posX: 0,
        posY: 1.5,
        posZ: 3.5
      };

      const risks = detectLightPenetrationRisks(
        [penetratingLight],
        [semiTransparentWall],
        10,
        10,
        [nearbyArtwork]
      );

      expect(risks[0].description).toContain(nearbyArtwork.name);
      expect(risks[0].artworkId).toBe(nearbyArtwork.id);
    });

    it('穿透点位置应正确记录', () => {
      const risks = detectLightPenetrationRisks(
        [penetratingLight],
        [semiTransparentWall],
        10,
        10,
        [mockArtwork]
      );

      expect(risks[0].posX).toBeDefined();
      expect(risks[0].posY).toBeDefined();
      expect(risks[0].posZ).toBeDefined();
    });

    it('多个光源应分别检测穿透风险', () => {
      const light1: LightSource = { ...penetratingLight, id: 'light-1', posX: -1 };
      const light2: LightSource = { ...penetratingLight, id: 'light-2', posX: 1 };
      const safeLight: LightSource = { ...penetratingLight, id: 'light-3', angleX: -90 };

      const risks = detectLightPenetrationRisks(
        [light1, light2, safeLight],
        [semiTransparentWall],
        10,
        10,
        [mockArtwork]
      );

      expect(risks).toHaveLength(2);
      expect(risks.filter(r => r.lightSourceId === 'light-1')).toHaveLength(1);
      expect(risks.filter(r => r.lightSourceId === 'light-2')).toHaveLength(1);
    });
  });

  describe('综合风险检测', () => {
    const semiTransparentWall: Wall = {
      id: 'wall-semi',
      start: { x: -3, y: 0, z: 2 },
      end: { x: 3, y: 0, z: 2 },
      height: 3,
      thickness: 0.2,
      material: '石膏板',
      opacity: 0.5
    };

    const mockGallery = {
      id: 'gallery-test',
      name: '测试展厅',
      width: 10,
      height: 4,
      depth: 10,
      walls: [semiTransparentWall],
      material: '混凝土',
      createdBy: 'test-user',
      createdAt: new Date().toISOString()
    };

    it('应同时检测多种类型的风险', () => {
      const highLight: LightSource = {
        ...mockLightSource,
        intensity: 15000
      };

      const penetratingLight: LightSource = {
        id: 'light-penetrate',
        galleryId: 'gallery-test',
        name: '穿透光源',
        type: 'spot',
        power: 30,
        intensity: 5000,
        posX: 0,
        posY: 2,
        posZ: 0,
        angleX: -45,
        angleY: 0,
        angleZ: 0,
        beamAngle: 30,
        colorTemperature: 3200,
        createdBy: 'test-user',
        createdAt: new Date().toISOString()
      };

      const risks = detectAllRisks(
        mockGallery,
        [highLight, penetratingLight],
        [mockArtwork],
        mockExhibition,
        []
      );

      const overIlluminationRisks = risks.filter(r => r.type === 'over_illumination');
      const penetrationRisks = risks.filter(r => r.type === 'light_penetration');

      expect(overIlluminationRisks.length).toBeGreaterThan(0);
      expect(penetrationRisks.length).toBeGreaterThan(0);
    });

    it('无风险时应返回空数组', () => {
      const safeLight: LightSource = {
        ...mockLightSource,
        intensity: 100
      };

      const risks = detectAllRisks(
        mockGallery,
        [safeLight],
        [mockArtwork],
        mockExhibition,
        []
      );

      expect(risks).toHaveLength(0);
    });

    it('关闭光线追踪时，不检测穿透风险', () => {
      const penetratingLight: LightSource = {
        id: 'light-penetrate',
        galleryId: 'gallery-test',
        name: '穿透光源',
        type: 'spot',
        power: 30,
        intensity: 5000,
        posX: 0,
        posY: 2,
        posZ: 0,
        angleX: -45,
        angleY: 0,
        angleZ: 0,
        beamAngle: 30,
        colorTemperature: 3200,
        createdBy: 'test-user',
        createdAt: new Date().toISOString()
      };

      const risksWithRay = detectAllRisks(
        mockGallery,
        [penetratingLight],
        [mockArtwork],
        mockExhibition,
        [],
        true
      );

      const risksWithoutRay = detectAllRisks(
        mockGallery,
        [penetratingLight],
        [mockArtwork],
        mockExhibition,
        [],
        false
      );

      expect(risksWithRay.filter(r => r.type === 'light_penetration').length).toBeGreaterThan(0);
      expect(risksWithoutRay.filter(r => r.type === 'light_penetration')).toHaveLength(0);
    });

    it('风险检测结果应包含完整的风险信息', () => {
      const highLight: LightSource = {
        ...mockLightSource,
        intensity: 15000
      };

      const risks = detectAllRisks(
        mockGallery,
        [highLight],
        [mockArtwork],
        mockExhibition,
        []
      );

      const risk = risks[0];
      expect(risk.id).toBeDefined();
      expect(risk.type).toBeDefined();
      expect(risk.severity).toBeDefined();
      expect(risk.status).toBe('detected');
      expect(risk.description).toBeDefined();
      expect(risk.measuredValue).toBeDefined();
      expect(risk.threshold).toBeDefined();
      expect(risk.exceedRatio).toBeDefined();
      expect(risk.detectedAt).toBeDefined();
    });

    it('缺少必要参数时返回空数组', () => {
      const risks1 = detectAllRisks(null, [mockLightSource], [mockArtwork], mockExhibition, []);
      const risks2 = detectAllRisks(mockGallery, [mockLightSource], [mockArtwork], null, []);

      expect(risks1).toHaveLength(0);
      expect(risks2).toHaveLength(0);
    });
  });
});
