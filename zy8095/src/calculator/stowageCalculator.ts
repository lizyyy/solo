import type { StowageState, CalculationResult, Bay, CargoItem, CargoPlacement } from '@/types';

const DEFAULT_WEIGHT = 20;

export function calculateStowage(state: StowageState): CalculationResult {
  const overloadWarnings = calculateOverload(state);
  const dangerousGoodsConflicts = calculateDangerousGoodsConflicts(state);
  const weights = calculateWeights(state);
  const centerOfGravity = calculateCenterOfGravity(state);

  return {
    totalWeight: weights.total,
    centerOfGravity,
    portStarboardBalance: weights.portStarboardBalance,
    foreAftBalance: weights.foreAftBalance,
    overloadWarnings,
    dangerousGoodsConflicts,
  };
}

function calculateWeights(state: StowageState) {
  let totalWeight = 0;
  let portWeight = 0;
  let starboardWeight = 0;
  let foreWeight = 0;
  let aftWeight = 0;

  const bayWeightMap = new Map<string, number>();

  for (const placement of state.placements) {
    const cargo = state.cargoItems.find(c => c.id === placement.cargoId);
    if (!cargo) continue;

    const weight = cargo.weight ?? DEFAULT_WEIGHT;
    totalWeight += weight;

    const bay = state.bays.find(b => b.id === placement.bayId);
    if (!bay) continue;

    const currentWeight = bayWeightMap.get(bay.id) || 0;
    bayWeightMap.set(bay.id, currentWeight + weight);

    if (bay.position.x < 0) {
      portWeight += weight;
    } else {
      starboardWeight += weight;
    }

    if (bay.position.z < 0) {
      foreWeight += weight;
    } else {
      aftWeight += weight;
    }
  }

  return {
    total: totalWeight,
    portStarboardBalance: portWeight - starboardWeight,
    foreAftBalance: foreWeight - aftWeight,
    bayWeights: bayWeightMap,
  };
}

function calculateCenterOfGravity(state: StowageState) {
  let totalWeight = 0;
  let momentX = 0;
  let momentY = 0;
  let momentZ = 0;

  for (const placement of state.placements) {
    const cargo = state.cargoItems.find(c => c.id === placement.cargoId);
    if (!cargo) continue;

    const weight = cargo.weight ?? DEFAULT_WEIGHT;
    totalWeight += weight;

    const bay = state.bays.find(b => b.id === placement.bayId);
    if (!bay) continue;

    const absoluteX = bay.position.x + placement.position.x;
    const absoluteY = bay.position.y + placement.position.y;
    const absoluteZ = bay.position.z + placement.position.z;

    momentX += weight * absoluteX;
    momentY += weight * absoluteY;
    momentZ += weight * absoluteZ;
  }

  if (totalWeight === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  return {
    x: momentX / totalWeight,
    y: momentY / totalWeight,
    z: momentZ / totalWeight,
  };
}

function calculateOverload(state: StowageState) {
  const warnings = [];
  const weights = calculateWeights(state);

  for (const bay of state.bays) {
    const currentWeight = weights.bayWeights.get(bay.id) || 0;
    if (currentWeight > bay.maxWeight) {
      warnings.push({
        bayId: bay.id,
        bayName: bay.name,
        currentWeight,
        maxWeight: bay.maxWeight,
      });
    }
  }

  return warnings;
}

function calculateDangerousGoodsConflicts(state: StowageState) {
  const conflicts = [];
  const dangerousPlacements: Array<{ placement: CargoPlacement; cargo: CargoItem; bay: Bay }> = [];

  for (const placement of state.placements) {
    const cargo = state.cargoItems.find(c => c.id === placement.cargoId);
    if (!cargo || !cargo.isDangerous || !cargo.dangerousClass) continue;

    const bay = state.bays.find(b => b.id === placement.bayId);
    if (!bay) continue;

    dangerousPlacements.push({ placement, cargo, bay });
  }

  for (let i = 0; i < dangerousPlacements.length; i++) {
    for (let j = i + 1; j < dangerousPlacements.length; j++) {
      const d1 = dangerousPlacements[i];
      const d2 = dangerousPlacements[j];

      const distance = calculateDistance(
        d1.bay.position.x + d1.placement.position.x,
        d1.bay.position.y + d1.placement.position.y,
        d1.bay.position.z + d1.placement.position.z,
        d2.bay.position.x + d2.placement.position.x,
        d2.bay.position.y + d2.placement.position.y,
        d2.bay.position.z + d2.placement.position.z,
      );

      const requiredDistance = state.rules.dangerousGoods.isolationDistance;
      const incompatibleClasses = state.rules.dangerousGoods.incompatibleClasses;

      const isIncompatible = incompatibleClasses[d1.cargo.dangerousClass!]?.includes(d2.cargo.dangerousClass!) ||
                            incompatibleClasses[d2.cargo.dangerousClass!]?.includes(d1.cargo.dangerousClass!);

      if (isIncompatible && distance < requiredDistance) {
        conflicts.push({
          cargo1Id: d1.cargo.id,
          cargo2Id: d2.cargo.id,
          distance,
          requiredDistance,
          classes: {
            class1: d1.cargo.dangerousClass!,
            class2: d2.cargo.dangerousClass!,
          },
        });
      }
    }
  }

  return conflicts;
}

function calculateDistance(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): number {
  return Math.sqrt(
    Math.pow(x2 - x1, 2) +
    Math.pow(y2 - y1, 2) +
    Math.pow(z2 - z1, 2)
  );
}

export function getUnplacedCargo(state: StowageState): CargoItem[] {
  const placedIds = new Set(state.placements.map(p => p.cargoId));
  return state.cargoItems.filter(c => !placedIds.has(c.id));
}

export function getBayLoad(bayId: string, state: StowageState): number {
  let load = 0;
  for (const placement of state.placements) {
    if (placement.bayId !== bayId) continue;
    const cargo = state.cargoItems.find(c => c.id === placement.cargoId);
    if (cargo) {
      load += cargo.weight ?? DEFAULT_WEIGHT;
    }
  }
  return load;
}