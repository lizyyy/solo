import type { StarField, Star, Vec3 } from '../types';
import { generateStarField as generateStars, calculateGravitationalLensing } from '../physics/lensing';

const now = new Date();

export const generateStarField = (
  count: number,
  distance: number,
  density: number,
  blackHoleMass: number,
  observerPosition: Vec3,
  lensStrength: number = 1.0
): StarField => {
  const rawStars = generateStars(count, distance, density);

  const stars: Star[] = rawStars.map((rawStar, index) => {
    const lensing = calculateGravitationalLensing(
      rawStar.position,
      blackHoleMass,
      observerPosition,
      lensStrength
    );

    return {
      id: `star-${index.toString().padStart(4, '0')}`,
      type: 'star',
      position: rawStar.position,
      magnitude: rawStar.magnitude,
      temperature: rawStar.temperature,
      isLensed: lensing.magnification > 1.1,
      lensedPosition: lensing.isVisible ? lensing.lensedPosition : undefined,
      magnification: lensing.magnification,
    };
  });

  return {
    id: 'sf-001',
    starCount: stars.length,
    distance,
    stars,
    dataSource: '随机生成的模拟星场，基于银河系恒星分布统计',
    version: '2.0.0',
    createdAt: now,
  };
};

export const STAR_FIELD_VERSION = '2.0.0';
export const STAR_FIELD_SOURCE = 'GAIA DR3 恒星分布模型（模拟）';
