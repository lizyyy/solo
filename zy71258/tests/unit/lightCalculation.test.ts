import { describe, it, expect } from 'vitest';
import type { LightSource, Wall, Point3D } from '@/types';
import {
  calculateSingleIllumination,
  calculateTotalIllumination,
  checkLightPenetration
} from '@/hooks/useLightCalculation';

describe('光照计算单元测试', () => {
  const mockLightSource: LightSource = {
    id: 'light-test-001',
    galleryId: 'gallery-test',
    name: '测试射灯',
    type: 'spot',
    power: 30,
    intensity: 2500,
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

  const emptyWalls: Wall[] = [];

  describe('反向距离平方定律', () => {
    it('距离加倍时，照度应为原来的1/4', () => {
      const point1: Point3D = { x: 0, y: 1.5, z: 0 };
      const point2: Point3D = { x: 0, y: 0, z: 0 };

      const illumination1 = calculateSingleIllumination(mockLightSource, point1, emptyWalls);
      const illumination2 = calculateSingleIllumination(mockLightSource, point2, emptyWalls);

      const distance1 = 1.5;
      const distance2 = 3;
      const expectedRatio = (distance1 * distance1) / (distance2 * distance2);

      expect(illumination2).toBeCloseTo(illumination1 * expectedRatio, 5);
    });

    it('距离趋近于0时，返回光源强度', () => {
      const nearPoint: Point3D = { x: 0, y: 2.95, z: 0 };
      const illumination = calculateSingleIllumination(mockLightSource, nearPoint, emptyWalls);
      expect(illumination).toBe(mockLightSource.intensity);
    });

    it('不同距离的照度值应符合距离平方反比关系', () => {
      const distances = [1, 2, 3, 4, 5];
      const results: number[] = [];

      distances.forEach(d => {
        const point: Point3D = { x: 0, y: 3 - d, z: 0 };
        results.push(calculateSingleIllumination(mockLightSource, point, emptyWalls));
      });

      for (let i = 0; i < results.length - 1; i++) {
        const ratio = results[i + 1] / results[i];
        const expectedRatio = (distances[i] * distances[i]) / (distances[i + 1] * distances[i + 1]);
        expect(ratio).toBeCloseTo(expectedRatio, 5);
      }
    });
  });

  describe('入射角计算', () => {
    it('光线垂直入射时，cos(入射角)=1，照度最大', () => {
      const verticalPoint: Point3D = { x: 0, y: 1.5, z: 0 };
      const illumination = calculateSingleIllumination(mockLightSource, verticalPoint, emptyWalls);
      expect(illumination).toBeGreaterThan(0);
    });

    it('光线斜射时，照度应乘以cos(入射角)', () => {
      const directPoint: Point3D = { x: 0, y: 1.5, z: 0 };
      const angledPoint: Point3D = { x: 0.2, y: 1.5, z: 0 };

      const directIllumination = calculateSingleIllumination(mockLightSource, directPoint, emptyWalls);
      const angledIllumination = calculateSingleIllumination(mockLightSource, angledPoint, emptyWalls);

      const dx = 0.2;
      const dy = 3 - 1.5;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const incidentAngle = Math.atan2(dx, dy);
      const cosAngle = Math.cos(incidentAngle);
      const distRatio = (1.5 * 1.5) / (distance * distance);
      const beamHalfAngle = (30 / 2) * (Math.PI / 180);
      const ratio = incidentAngle / beamHalfAngle;
      const beamAttenuation = Math.pow(1 - ratio * ratio, 2);

      expect(angledIllumination).toBeLessThan(directIllumination);
      expect(angledIllumination).toBeCloseTo(directIllumination * distRatio * cosAngle * beamAttenuation, 0);
    });

    it('超出光束角范围时，照度应为0', () => {
      const outsideBeamPoint: Point3D = { x: 5, y: 1.5, z: 0 };
      const illumination = calculateSingleIllumination(mockLightSource, outsideBeamPoint, emptyWalls);
      expect(illumination).toBe(0);
    });
  });

  describe('光束衰减', () => {
    it('光束中心照度最高', () => {
      const centerPoint: Point3D = { x: 0, y: 1.5, z: 0 };
      const edgePoint: Point3D = { x: 0.3, y: 1.5, z: 0 };

      const centerIllumination = calculateSingleIllumination(mockLightSource, centerPoint, emptyWalls);
      const edgeIllumination = calculateSingleIllumination(mockLightSource, edgePoint, emptyWalls);

      expect(centerIllumination).toBeGreaterThan(edgeIllumination);
    });

    it('光束衰减应遵循平滑曲线', () => {
      const points: Point3D[] = [];
      for (let x = 0; x <= 0.8; x += 0.1) {
        points.push({ x, y: 1.5, z: 0 });
      }

      const illuminations = points.map(p => calculateSingleIllumination(mockLightSource, p, emptyWalls));

      for (let i = 0; i < illuminations.length - 1; i++) {
        expect(illuminations[i]).toBeGreaterThanOrEqual(illuminations[i + 1]);
      }
    });

    it('光束角边缘处衰减应为0', () => {
      const beamHalfAngleRad = (mockLightSource.beamAngle / 2) * (Math.PI / 180);
      const distance = 1.5;
      const edgeX = distance * Math.tan(beamHalfAngleRad) + 0.1;

      const edgePoint: Point3D = { x: edgeX, y: 1.5, z: 0 };
      const illumination = calculateSingleIllumination(mockLightSource, edgePoint, emptyWalls);

      expect(illumination).toBe(0);
    });
  });

  describe('墙体遮挡检测', () => {
    const blockingWall: Wall = {
      id: 'wall-block',
      start: { x: 0, y: 0, z: -0.75 },
      end: { x: 0, y: 3, z: -0.75 },
      height: 3,
      thickness: 0.3,
      material: '混凝土',
      opacity: 1
    };

    it('光线被墙体遮挡时，照度应为0', () => {
      const targetPoint: Point3D = { x: 0, y: 1.5, z: -2 };
      const illumination = calculateSingleIllumination(mockLightSource, targetPoint, [blockingWall]);
      expect(illumination).toBe(0);
    });

    it('光线未被遮挡时，应有正常照度', () => {
      const targetPoint: Point3D = { x: 0.2, y: 1.5, z: 0 };
      const illumination = calculateSingleIllumination(mockLightSource, targetPoint, [blockingWall]);
      expect(illumination).toBeGreaterThan(0);
    });

    it('多个光源叠加时，总照度为各光源照度之和', () => {
      const light1: LightSource = { ...mockLightSource, id: 'l1', posX: -1, intensity: 1000 };
      const light2: LightSource = { ...mockLightSource, id: 'l2', posX: 1, intensity: 1000 };
      const targetPoint: Point3D = { x: 0, y: 1.5, z: 0 };

      const totalIllumination = calculateTotalIllumination([light1, light2], targetPoint, emptyWalls);
      const ill1 = calculateSingleIllumination(light1, targetPoint, emptyWalls);
      const ill2 = calculateSingleIllumination(light2, targetPoint, emptyWalls);

      expect(totalIllumination).toBeCloseTo(ill1 + ill2, 5);
    });

    it('不透明墙体完全遮挡光线', () => {
      const opaqueWall: Wall = { ...blockingWall, opacity: 1 };
      const targetPoint: Point3D = { x: 0, y: 1.5, z: -2 };
      const illumination = calculateSingleIllumination(mockLightSource, targetPoint, [opaqueWall]);
      expect(illumination).toBe(0);
    });
  });

  describe('光线穿透检测', () => {
    const semiTransparentWall: Wall = {
      id: 'wall-semi',
      start: { x: 1, y: 0, z: 0 },
      end: { x: 1, y: 3, z: 0 },
      height: 3,
      thickness: 0.2,
      material: '玻璃',
      opacity: 0.5
    };

    const opaqueWall: Wall = {
      ...semiTransparentWall,
      id: 'wall-opaque',
      opacity: 1
    };

    const penetratingLight: LightSource = {
      id: 'light-penetrate',
      galleryId: 'gallery-test',
      name: '穿透测试光源',
      type: 'spot',
      power: 30,
      intensity: 5000,
      posX: 0,
      posY: 1.5,
      posZ: 0,
      angleX: 0,
      angleY: 90,
      angleZ: 0,
      beamAngle: 30,
      colorTemperature: 3200,
      createdBy: 'test-user',
      createdAt: new Date().toISOString()
    };

    it('半透明墙体应检测到光线穿透', () => {
      const result = checkLightPenetration(penetratingLight, [semiTransparentWall], 10, 10);
      expect(result.hasPenetration).toBe(true);
      expect(result.wallId).toBe('wall-semi');
      expect(result.penetrationPoint).toBeDefined();
    });

    it('不透明墙体不应检测到光线穿透', () => {
      const result = checkLightPenetration(penetratingLight, [opaqueWall], 10, 10);
      expect(result.hasPenetration).toBe(false);
    });

    it('光线方向未指向墙体时，无穿透', () => {
      const downwardLight: LightSource = {
        ...penetratingLight,
        angleX: -90,
        angleY: 0
      };

      const result = checkLightPenetration(downwardLight, [semiTransparentWall], 10, 10);
      expect(result.hasPenetration).toBe(false);
    });

    it('穿透点应在墙体上', () => {
      const result = checkLightPenetration(penetratingLight, [semiTransparentWall], 10, 10);
      expect(result.hasPenetration).toBe(true);
      expect(result.penetrationPoint?.x).toBeCloseTo(1, 0);
      expect(result.penetrationPoint?.z).toBeCloseTo(0, 0);
    });
  });
});
