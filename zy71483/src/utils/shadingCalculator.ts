import type { Obstacle, PVModule, ShadingResult } from '../types';

const MODULE_WIDTH = 100;
const MODULE_HEIGHT = 80;
const MODULE_GAP = 10;

export function calculateShadowLength(altitude: number): number {
  if (altitude <= 0) return Infinity;
  if (altitude >= 90) return 0;
  return 1 / Math.tan((altitude * Math.PI) / 180);
}

export function calculateShadowDirection(azimuth: number): { dx: number; dy: number } {
  const rad = (azimuth * Math.PI) / 180;
  return {
    dx: Math.sin(rad),
    dy: -Math.cos(rad),
  };
}

export function getModulePosition(
  row: number,
  col: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: col * (MODULE_WIDTH + MODULE_GAP),
    y: row * (MODULE_HEIGHT + MODULE_GAP),
    width: MODULE_WIDTH,
    height: MODULE_HEIGHT,
  };
}

function calculateIntersectionArea(
  rect1: { x: number; y: number; width: number; height: number },
  rect2: { x: number; y: number; width: number; height: number }
): number {
  const x1 = Math.max(rect1.x, rect2.x);
  const y1 = Math.max(rect1.y, rect2.y);
  const x2 = Math.min(rect1.x + rect1.width, rect2.x + rect2.width);
  const y2 = Math.min(rect1.y + rect1.height, rect2.y + rect2.height);

  if (x2 <= x1 || y2 <= y1) return 0;
  return (x2 - x1) * (y2 - y1);
}

function projectObstacleShadow(
  obstacle: Obstacle,
  shadowLength: number,
  shadowDirection: { dx: number; dy: number }
): { x: number; y: number; width: number; height: number } {
  const scale = Math.min(shadowLength, 5);
  const shadowOffsetX = shadowDirection.dx * obstacle.size.height * scale;
  const shadowOffsetY = shadowDirection.dy * obstacle.size.height * scale;

  return {
    x: obstacle.position.x + Math.min(0, shadowOffsetX),
    y: obstacle.position.y + Math.min(0, shadowOffsetY),
    width: obstacle.size.width + Math.abs(shadowOffsetX),
    height: obstacle.size.height + Math.abs(shadowOffsetY),
  };
}

export function calculateShadingRate(
  modulePosition: { x: number; y: number; width: number; height: number },
  obstacles: Obstacle[],
  sunAngle: { altitude: number; azimuth: number }
): number {
  const shadowLength = calculateShadowLength(sunAngle.altitude);
  const shadowDirection = calculateShadowDirection(sunAngle.azimuth);

  const shadowAreas = obstacles.map((obstacle) =>
    projectObstacleShadow(obstacle, shadowLength, shadowDirection)
  );

  const totalIntersection = shadowAreas.reduce(
    (sum, shadow) => sum + calculateIntersectionArea(modulePosition, shadow),
    0
  );

  const moduleArea = modulePosition.width * modulePosition.height;
  return Math.min(1, totalIntersection / moduleArea);
}

export function calculateAllShading(
  modules: PVModule[],
  obstacles: Obstacle[],
  sunAngle: { altitude: number; azimuth: number }
): ShadingResult[] {
  return modules.map((module) => {
    const modulePos = getModulePosition(module.position.row, module.position.col);
    const shadingRate = calculateShadingRate(modulePos, obstacles, sunAngle);

    const cellCount = 6;
    const affectedCells: number[] = [];
    if (shadingRate > 0) {
      const affectedCount = Math.ceil(shadingRate * cellCount);
      for (let i = 0; i < affectedCount; i++) {
        affectedCells.push(i);
      }
    }

    return {
      moduleId: module.id,
      shadingRate,
      affectedCells,
    };
  });
}

export function getArrayDimensions(rows: number, cols: number): { width: number; height: number } {
  return {
    width: cols * (MODULE_WIDTH + MODULE_GAP) - MODULE_GAP + 40,
    height: rows * (MODULE_HEIGHT + MODULE_GAP) - MODULE_GAP + 40,
  };
}

export { MODULE_WIDTH, MODULE_HEIGHT, MODULE_GAP };
