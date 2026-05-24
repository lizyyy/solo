import { Point3D, PointCloudData } from '@/types';

function generateGaussianNoise(std: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * std;
}

function generatePilePoints(
  centerX: number,
  centerZ: number,
  baseRadius: number,
  height: number,
  noiseStd: number,
  pointDensity: number
): Point3D[] {
  const points: Point3D[] = [];
  const numPoints = Math.floor(Math.PI * baseRadius * baseRadius * pointDensity);

  for (let i = 0; i < numPoints; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * baseRadius;
    const x = centerX + r * Math.cos(angle);
    const z = centerZ + r * Math.sin(angle);

    const normalizedDist = r / baseRadius;
    const pileHeight = height * (1 - normalizedDist * normalizedDist);

    const y = pileHeight + generateGaussianNoise(noiseStd);

    const baseColor = 0x8B7355;
    const colorVariation = Math.floor(generateGaussianNoise(10) * 1000);
    const color = Math.max(0, Math.min(0xFFFFFF, baseColor + colorVariation));

    points.push({ x, y, z, color });
  }

  return points;
}

function generateGroundPoints(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  baseHeight: number,
  noiseStd: number,
  pointDensity: number
): Point3D[] {
  const points: Point3D[] = [];
  const area = (maxX - minX) * (maxZ - minZ);
  const numPoints = Math.floor(area * pointDensity * 0.3);

  for (let i = 0; i < numPoints; i++) {
    const x = minX + Math.random() * (maxX - minX);
    const z = minZ + Math.random() * (maxZ - minZ);
    const y = baseHeight + generateGaussianNoise(noiseStd * 0.5);

    points.push({ x, y, z, color: 0x5C5C5C });
  }

  return points;
}

export function generateSamplePointCloud(): PointCloudData {
  const allPoints: Point3D[] = [];

  const piles = [
    { centerX: -20, centerZ: -15, radius: 12, height: 8, noise: 0.3, density: 8 },
    { centerX: 15, centerZ: -10, radius: 10, height: 6, noise: 0.25, density: 8 },
    { centerX: 0, centerZ: 15, radius: 14, height: 10, noise: 0.35, density: 8 },
    { centerX: 25, centerZ: 20, radius: 8, height: 5, noise: 0.2, density: 7 },
  ];

  piles.forEach(pile => {
    const points = generatePilePoints(
      pile.centerX,
      pile.centerZ,
      pile.radius,
      pile.height,
      pile.noise,
      pile.density
    );
    allPoints.push(...points);
  });

  const groundPoints = generateGroundPoints(-50, 50, -50, 50, 0, 0.1, 2);
  allPoints.push(...groundPoints);

  return {
    id: 'sample-001',
    name: '矿区A区-2024年5月盘点',
    points: allPoints,
    createdAt: new Date(),
  };
}

export const SAMPLE_BOUNDARIES = [
  {
    id: 'boundary-1',
    name: '1号料堆',
    vertices: [
      { x: -32, z: -27 },
      { x: -8, z: -27 },
      { x: -5, z: -10 },
      { x: -12, z: 0 },
      { x: -30, z: -3 },
      { x: -35, z: -18 },
    ],
    baseHeight: 0,
    materialId: 'ore',
  },
  {
    id: 'boundary-2',
    name: '2号料堆',
    vertices: [
      { x: 5, z: -20 },
      { x: 25, z: -20 },
      { x: 28, z: -5 },
      { x: 20, z: 2 },
      { x: 5, z: 0 },
    ],
    baseHeight: 0,
    materialId: 'coal',
  },
  {
    id: 'boundary-3',
    name: '3号料堆',
    vertices: [
      { x: -14, z: 5 },
      { x: 14, z: 5 },
      { x: 18, z: 22 },
      { x: 8, z: 30 },
      { x: -10, z: 28 },
      { x: -18, z: 18 },
    ],
    baseHeight: 0,
    materialId: 'sand',
  },
];
