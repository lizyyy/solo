import { Alert, Bay, Cargo } from '../types';

function areAdjacent(bay1: Bay, bay2: Bay): boolean {
  const rowDiff = Math.abs(bay1.position.row - bay2.position.row);
  const tierDiff = Math.abs(bay1.position.tier - bay2.position.tier);
  const stackDiff = Math.abs(bay1.position.stack - bay2.position.stack);
  return rowDiff <= 1 && tierDiff <= 1 && stackDiff <= 1 && !(rowDiff === 0 && tierDiff === 0 && stackDiff === 0);
}

const DANGER_LEVEL_PRIORITY: Record<string, number> = {
  class1: 1,
  class2: 2,
  class3: 3,
  class4: 4,
};

const INCOMPATIBLE_LEVELS: Record<string, string[]> = {
  class1: ['class2', 'class3', 'class4'],
  class2: ['class1', 'class3'],
  class3: ['class1', 'class2', 'class4'],
  class4: ['class1', 'class3'],
};

export function validateRules(bays: Bay[], cargoList: Cargo[]): Alert[] {
  const alerts: Alert[] = [];
  const loadedBays = bays.filter((bay) => bay.occupiedBy);

  for (const bay of loadedBays) {
    const cargo = cargoList.find((c) => c.id === bay.occupiedBy);
    if (!cargo) continue;

    if (cargo.requiresPower && !bay.hasPower) {
      alerts.push({
        id: `power-${bay.id}`,
        type: 'power',
        message: `冷藏箱 ${cargo.name} 装载在无电源舱位 ${bay.id}`,
        severity: 'error',
        relatedItems: [bay.id, cargo.id],
      });
    }

    if (cargo.weight > bay.maxWeight) {
      alerts.push({
        id: `weight-${bay.id}`,
        type: 'weight',
        message: `货物 ${cargo.name} (${cargo.weight}吨) 超过舱位 ${bay.id} 最大承重 (${bay.maxWeight}吨)`,
        severity: 'error',
        relatedItems: [bay.id, cargo.id],
      });
    }

    if (cargo.type === 'dangerous' && cargo.dangerLevel) {
      for (const otherBay of loadedBays) {
        if (otherBay.id === bay.id) continue;
        
        const otherCargo = cargoList.find((c) => c.id === otherBay.occupiedBy);
        if (!otherCargo || otherCargo.type !== 'dangerous') continue;

        if (areAdjacent(bay, otherBay)) {
          const incompatible = INCOMPATIBLE_LEVELS[cargo.dangerLevel] || [];
          if (incompatible.includes(otherCargo.dangerLevel || '')) {
            const alertId = `danger-${bay.id}-${otherBay.id}`;
            if (!alerts.find((a) => a.id === alertId)) {
              alerts.push({
                id: alertId,
                type: 'danger',
                message: `危险品 ${cargo.name} 与 ${otherCargo.name} 违规相邻`,
                severity: 'error',
                relatedItems: [bay.id, otherBay.id, cargo.id, otherCargo.id],
              });
            }
          }
        }
      }
    }
  }

  return alerts;
}

export function canLoadCargo(cargo: Cargo, bay: Bay, bays: Bay[], cargoList: Cargo[]): Alert[] {
  const alerts: Alert[] = [];

  if (bay.occupiedBy) {
    alerts.push({
      id: `occupied-${bay.id}`,
      type: 'weight',
      message: `舱位 ${bay.id} 已被占用`,
      severity: 'error',
      relatedItems: [bay.id],
    });
    return alerts;
  }

  if (cargo.requiresPower && !bay.hasPower) {
    alerts.push({
      id: `power-${bay.id}-${cargo.id}`,
      type: 'power',
      message: `该舱位无冷藏电源`,
      severity: 'warning',
      relatedItems: [bay.id, cargo.id],
    });
  }

  if (cargo.weight > bay.maxWeight) {
    alerts.push({
      id: `weight-${bay.id}-${cargo.id}`,
      type: 'weight',
      message: `货物重量超过舱位最大承重`,
      severity: 'warning',
      relatedItems: [bay.id, cargo.id],
    });
  }

  if (cargo.type === 'dangerous' && cargo.dangerLevel) {
    const loadedBays = bays.filter((b) => b.occupiedBy);
    for (const otherBay of loadedBays) {
      const otherCargo = cargoList.find((c) => c.id === otherBay.occupiedBy);
      if (!otherCargo || otherCargo.type !== 'dangerous') continue;

      if (areAdjacent(bay, otherBay)) {
        const incompatible = INCOMPATIBLE_LEVELS[cargo.dangerLevel] || [];
        if (incompatible.includes(otherCargo.dangerLevel || '')) {
          alerts.push({
            id: `danger-${bay.id}-${otherBay.id}-${cargo.id}`,
            type: 'danger',
            message: `与已装载危险品 ${otherCargo.name} 违规相邻`,
            severity: 'warning',
            relatedItems: [bay.id, otherBay.id, cargo.id, otherCargo.id],
          });
        }
      }
    }
  }

  return alerts;
}
