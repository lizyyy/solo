import { Cargo, Bay, CenterOfGravity, BAY_SCALE, SHIP_CENTER, GRAVITY_WARNING_THRESHOLD } from '../types';

export function calculateCenterOfGravity(
  bays: Bay[],
  cargoList: Cargo[]
): CenterOfGravity {
  const loadedBays = bays.filter((bay) => bay.occupiedBy);
  
  if (loadedBays.length === 0) {
    return {
      x: SHIP_CENTER.x,
      y: SHIP_CENTER.y,
      z: SHIP_CENTER.z,
      isWarning: false,
      offset: 0,
    };
  }

  let totalWeight = 0;
  let weightedX = 0;
  let weightedY = 0;
  let weightedZ = 0;

  for (const bay of loadedBays) {
    const cargo = cargoList.find((c) => c.id === bay.occupiedBy);
    if (!cargo) continue;

    const bayCenterX = (bay.position.stack - 1.5) * BAY_SCALE * 2;
    const bayCenterY = bay.position.tier * BAY_SCALE + BAY_SCALE / 2;
    const bayCenterZ = (bay.position.row - 1) * BAY_SCALE * 2;

    totalWeight += cargo.weight;
    weightedX += cargo.weight * bayCenterX;
    weightedY += cargo.weight * bayCenterY;
    weightedZ += cargo.weight * bayCenterZ;
  }

  const cogX = weightedX / totalWeight;
  const cogY = weightedY / totalWeight;
  const cogZ = weightedZ / totalWeight;

  const xOffset = Math.abs(cogX - SHIP_CENTER.x);
  const zOffset = Math.abs(cogZ - SHIP_CENTER.z);
  const maxOffset = Math.max(xOffset, zOffset);
  const offset = maxOffset / (BAY_SCALE * 4);
  const isWarning = offset > GRAVITY_WARNING_THRESHOLD;

  return {
    x: cogX,
    y: cogY,
    z: cogZ,
    isWarning,
    offset: parseFloat(offset.toFixed(3)),
  };
}

export function getBayWorldPosition(bay: Bay): { x: number; y: number; z: number } {
  return {
    x: (bay.position.stack - 1.5) * BAY_SCALE * 2,
    y: bay.position.tier * BAY_SCALE,
    z: (bay.position.row - 1) * BAY_SCALE * 2,
  };
}
