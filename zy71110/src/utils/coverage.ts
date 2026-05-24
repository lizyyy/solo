import { Sprinkler, Environment, FieldConfig, CoverageResult, MissedZone } from '../types';

const degToRad = (deg: number) => (deg * Math.PI) / 180;

export function calculateEffectiveRadius(
  sprinkler: Sprinkler,
  environment: Environment,
  direction: number
): number {
  const { windSpeed, windDirection, slope, slopeDirection, globalPressure } = environment;
  const { radius, pressure } = sprinkler;

  const pressureFactor = Math.sqrt(pressure * globalPressure);

  const dirRad = degToRad(direction);
  const windDirRad = degToRad(windDirection);
  const windAngleDiff = Math.cos(dirRad - windDirRad);
  const windFactor = 1 + (windSpeed / 10) * windAngleDiff * 0.4;

  const slopeDirRad = degToRad(slopeDirection);
  const slopeAngleDiff = Math.cos(dirRad - slopeDirRad);
  const slopeRad = degToRad(slope);
  const slopeFactor = 1 - Math.sin(slopeRad) * slopeAngleDiff * 0.5;

  return radius * pressureFactor * windFactor * slopeFactor;
}

export function isPointCovered(
  px: number,
  pz: number,
  sprinklers: Sprinkler[],
  environment: Environment,
  threshold: number = 0.3
): { covered: boolean; intensity: number } {
  let totalIntensity = 0;

  for (const sprinkler of sprinklers) {
    const dx = px - sprinkler.x;
    const dz = pz - sprinkler.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance === 0) {
      totalIntensity += 1;
      continue;
    }

    const direction = (Math.atan2(dz, dx) * 180) / Math.PI;
    const effectiveRadius = calculateEffectiveRadius(sprinkler, environment, direction);

    if (distance <= effectiveRadius) {
      const intensity = 1 - distance / effectiveRadius;
      totalIntensity += intensity * intensity;
    }
  }

  return {
    covered: totalIntensity >= threshold,
    intensity: Math.min(totalIntensity, 2),
  };
}

export function calculateCoverage(
  sprinklers: Sprinkler[],
  environment: Environment,
  field: FieldConfig
): CoverageResult {
  const { width, height, resolution } = field;
  const gridX = Math.ceil(width / resolution);
  const gridZ = Math.ceil(height / resolution);
  const totalCells = gridX * gridZ;

  const heatmap = new Float32Array(totalCells);
  let coveredCells = 0;

  const halfWidth = width / 2;
  const halfHeight = height / 2;

  for (let iz = 0; iz < gridZ; iz++) {
    for (let ix = 0; ix < gridX; ix++) {
      const px = -halfWidth + (ix + 0.5) * resolution;
      const pz = -halfHeight + (iz + 0.5) * resolution;

      const { covered, intensity } = isPointCovered(px, pz, sprinklers, environment);

      const cellIndex = iz * gridX + ix;
      heatmap[cellIndex] = intensity;

      if (covered) {
        coveredCells++;
      }
    }
  }

  const cellArea = resolution * resolution;
  const totalArea = width * height;
  const coveredArea = coveredCells * cellArea;
  const missedArea = totalArea - coveredArea;
  const coverageRate = coveredCells / totalCells;

  const missedZones = findMissedZones(heatmap, gridX, gridZ, resolution, width, height);

  return {
    totalArea,
    coveredArea,
    missedArea,
    coverageRate,
    missedZones,
    heatmap,
    gridSize: gridX,
  };
}

function findMissedZones(
  heatmap: Float32Array,
  gridX: number,
  gridZ: number,
  resolution: number,
  width: number,
  height: number
): MissedZone[] {
  const visited = new Uint8Array(heatmap.length);
  const missedZones: MissedZone[] = [];
  const threshold = 0.3;

  const halfWidth = width / 2;
  const halfHeight = height / 2;

  for (let iz = 0; iz < gridZ; iz++) {
    for (let ix = 0; ix < gridX; ix++) {
      const idx = iz * gridX + ix;

      if (visited[idx] || heatmap[idx] >= threshold) {
        continue;
      }

      const zone = floodFill(heatmap, visited, ix, iz, gridX, gridZ, threshold, resolution);

      if (zone.area >= 1.0) {
        const isCorner =
          (Math.abs(zone.x - (-halfWidth + 2)) < 3 || Math.abs(zone.x - (halfWidth - 2)) < 3) &&
          (Math.abs(zone.z - (-halfHeight + 2)) < 3 || Math.abs(zone.z - (halfHeight - 2)) < 3);

        const isEdge =
          Math.abs(zone.x) > halfWidth - 3 || Math.abs(zone.z) > halfHeight - 3;

        missedZones.push({
          x: zone.x,
          z: zone.z,
          area: zone.area,
          type: isCorner ? 'corner' : isEdge ? 'gap' : 'gap',
        });
      }
    }
  }

  return missedZones.sort((a, b) => b.area - a.area);
}

function floodFill(
  heatmap: Float32Array,
  visited: Uint8Array,
  startX: number,
  startZ: number,
  gridX: number,
  gridZ: number,
  threshold: number,
  resolution: number
): { x: number; z: number; area: number } {
  const stack: [number, number][] = [[startX, startZ]];
  let sumX = 0;
  let sumZ = 0;
  let count = 0;

  const halfWidth = (gridX * resolution) / 2;
  const halfHeight = (gridZ * resolution) / 2;

  while (stack.length > 0) {
    const [ix, iz] = stack.pop()!;
    const idx = iz * gridX + ix;

    if (ix < 0 || ix >= gridX || iz < 0 || iz >= gridZ) {
      continue;
    }

    if (visited[idx] || heatmap[idx] >= threshold) {
      continue;
    }

    visited[idx] = 1;
    sumX += -halfWidth + (ix + 0.5) * resolution;
    sumZ += -halfHeight + (iz + 0.5) * resolution;
    count++;

    stack.push([ix + 1, iz], [ix - 1, iz], [ix, iz + 1], [ix, iz - 1]);
  }

  return {
    x: count > 0 ? sumX / count : 0,
    z: count > 0 ? sumZ / count : 0,
    area: count * resolution * resolution,
  };
}

export function generateCoverageTextureData(
  coverageResult: CoverageResult,
  field: FieldConfig
): ImageData {
  const { heatmap, gridSize } = coverageResult;
  const gridZ = heatmap.length / gridSize;

  const canvas = document.createElement('canvas');
  canvas.width = gridSize;
  canvas.height = gridZ;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(gridSize, gridZ);

  for (let i = 0; i < heatmap.length; i++) {
    const intensity = heatmap[i];
    const pixelIndex = i * 4;

    const r = Math.floor(Math.min(255, intensity * 200 + 55));
    const g = Math.floor(Math.min(255, intensity < 0.3 ? 100 : 200));
    const b = Math.floor(intensity < 0.3 ? 100 : 150 + intensity * 105);
    const a = 180;

    if (intensity < 0.3) {
      imageData.data[pixelIndex] = 244;
      imageData.data[pixelIndex + 1] = 67;
      imageData.data[pixelIndex + 2] = 54;
      imageData.data[pixelIndex + 3] = a;
    } else {
      imageData.data[pixelIndex] = 33;
      imageData.data[pixelIndex + 1] = Math.floor(100 + intensity * 105);
      imageData.data[pixelIndex + 2] = Math.floor(150 + intensity * 105);
      imageData.data[pixelIndex + 3] = a;
    }
  }

  return imageData;
}
