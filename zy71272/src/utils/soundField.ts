import { Vector3, Musician, SoundPressureSample, RoomConfig } from '../types';
import { HEATMAP_GRID_SIZE } from './constants';
import { distance2D, clamp } from './helpers';

export const calculateSoundPressure = (
  sourcePos: Vector3,
  listenerPos: Vector3,
  sourceLevel: number,
  directivity: number = 0,
  sourceRotation: number = 0
): number => {
  const distance = distance2D(sourcePos, listenerPos);

  if (distance < 0.1) return sourceLevel;

  const distanceAttenuation = 20 * Math.log10(distance / 1.0);

  const angleToListener = Math.atan2(
    listenerPos.x - sourcePos.x,
    listenerPos.z - sourcePos.z
  );
  const angleDiff = Math.abs(angleToListener - sourceRotation);
  const normalizedAngleDiff = angleDiff > Math.PI ? 2 * Math.PI - angleDiff : angleDiff;
  const directivityAttenuation = directivity * (1 - Math.cos(normalizedAngleDiff)) * 6;

  return sourceLevel - distanceAttenuation - directivityAttenuation;
};

export const calculateCombinedSoundPressure = (
  sources: Musician[],
  listenerPos: Vector3
): number => {
  const pressures = sources.map(m => {
    const db = calculateSoundPressure(
      m.position,
      listenerPos,
      m.sourceLevel,
      m.directivity,
      m.rotation
    );
    return Math.pow(10, db / 20);
  });

  const combinedPressure = Math.sqrt(
    pressures.reduce((sum, p) => sum + p * p, 0)
  );

  if (combinedPressure <= 0) return 0;
  return 20 * Math.log10(combinedPressure);
};

export const generateHeatmapData = (
  musicians: Musician[],
  roomConfig: RoomConfig
): SoundPressureSample[] => {
  const samples: SoundPressureSample[] = [];
  const gridSize = HEATMAP_GRID_SIZE;

  const halfWidth = roomConfig.width / 2;
  const halfDepth = roomConfig.length / 2;

  for (let x = -halfWidth + gridSize / 2; x < halfWidth; x += gridSize) {
    for (let z = -halfDepth + gridSize / 2; z < halfDepth; z += gridSize) {
      const pos: Vector3 = { x, y: 1.2, z };
      const level = calculateCombinedSoundPressure(musicians, pos);
      samples.push({ position: pos, level });
    }
  }

  return samples;
};

export const calculateAvgSoundPressure = (
  musicians: Musician[],
  position: Vector3
): number => {
  return calculateCombinedSoundPressure(musicians, position);
};

export const calculateSoundPressureAtPoint = (
  musician: Musician,
  position: Vector3
): number => {
  return calculateSoundPressure(
    musician.position,
    position,
    musician.sourceLevel,
    musician.directivity,
    musician.rotation
  );
};

export const calculateVolumeBalanceScore = (
  musicians: Musician[],
  monitorPoints: Vector3[]
): number => {
  if (monitorPoints.length === 0 || musicians.length < 2) return 100;

  let totalDeviation = 0;
  const idealRatio = 1 / musicians.length;

  monitorPoints.forEach(mp => {
    const levels = musicians.map(m => ({
      level: calculateSoundPressureAtPoint(m, mp),
    }));

    const totalPressure = levels.reduce((sum, l) => sum + Math.pow(10, l.level / 20), 0);

    levels.forEach(l => {
      const ratio = totalPressure > 0 ? Math.pow(10, l.level / 20) / totalPressure : 0;
      totalDeviation += Math.abs(ratio - idealRatio);
    });
  });

  const avgDeviation = totalDeviation / (monitorPoints.length * musicians.length);
  const score = Math.max(0, 100 - avgDeviation * 200);

  return clamp(Math.round(score), 0, 100);
};
