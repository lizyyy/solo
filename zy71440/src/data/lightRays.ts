import type { LightRay, Vec3 } from '../types';
import { calculateGeodesic, generateRayStartPoints } from '../physics/geodesic';

const now = new Date();

export const generateLightRays = (
  blackHoleId: string,
  count: number,
  mass: number,
  observerDistance: number,
  lensStrength: number = 1.0
): LightRay[] => {
  const startPoints = generateRayStartPoints(count, observerDistance, mass);
  const rays: LightRay[] = [];

  startPoints.forEach(({ start, direction }, index) => {
    const result = calculateGeodesic(
      start,
      direction,
      mass,
      500,
      0.1,
      lensStrength
    );

    const endPoint = result.pathPoints[result.pathPoints.length - 1] as Vec3;

    rays.push({
      id: `ray-${index.toString().padStart(3, '0')}`,
      type: 'lightRay',
      blackHoleId,
      startPoint: start,
      endPoint,
      impactParameter: result.impactParameter,
      deflectionAngle: result.deflectionAngle,
      pathType: result.pathType,
      pathPoints: result.pathPoints,
      dataSource: '测地线方程数值积分',
      version: '1.2.0',
      createdAt: now,
    });
  });

  return rays;
};

export const getPathTypeDescription = (type: string): string => {
  switch (type) {
    case 'normal':
      return '正常偏折 - 光线在安全距离外经过黑洞，偏折角度较小';
    case 'critical':
      return '临界光线 - 接近光子球半径，可能产生爱因斯坦环';
    case 'captured':
      return '被捕获 - 光线穿过事件视界，无法逃逸';
    default:
      return '未知类型';
  }
};
