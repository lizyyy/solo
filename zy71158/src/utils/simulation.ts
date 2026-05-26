import { Stall, LevelConfig } from '@/types/game';

export function calculateTotalElectricity(stalls: Stall[]): number {
  return stalls.reduce((sum, stall) => {
    if (!stall.isOn) return sum;
    return sum + (stall.power / 100) * stall.maxPower;
  }, 0);
}

export function calculateStallSmoke(stall: Stall): number {
  if (!stall.isOn) return 0;
  const exhaustEfficiency = stall.exhaustLevel * 0.2;
  const baseSmoke = (stall.power / 100) * stall.maxPower * stall.smokeCoefficient * (1 - exhaustEfficiency);
  return Math.max(0, baseSmoke);
}

export function calculateTotalSmoke(stalls: Stall[]): number {
  let total = 0;
  stalls.forEach((stall) => {
    const ownSmoke = calculateStallSmoke(stall);
    const neighborImpact = calculateNeighborSmokeImpact(stalls, stall);
    total += ownSmoke + neighborImpact;
  });
  return total;
}

export function calculateDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

export function calculateNeighborSmokeImpact(
  stalls: Stall[],
  targetStall: Stall,
  maxDistance: number = 200
): number {
  let impact = 0;
  stalls.forEach((stall) => {
    if (stall.id === targetStall.id || !stall.isOn) return;
    const distance = calculateDistance(stall.position, targetStall.position);
    if (distance < maxDistance) {
      const decay = 1 - distance / maxDistance;
      impact += calculateStallSmoke(stall) * decay * 0.3;
    }
  });
  return impact;
}

export function isOverCapacity(
  stalls: Stall[],
  maxElectricity: number,
  extraLoad: number = 0
): boolean {
  const total = calculateTotalElectricity(stalls) + extraLoad;
  return total > maxElectricity;
}

export function getCapacityWarningLevel(
  stalls: Stall[],
  maxElectricity: number,
  extraLoad: number = 0
): 'safe' | 'warning' | 'danger' {
  const total = calculateTotalElectricity(stalls) + extraLoad;
  const ratio = total / maxElectricity;
  if (ratio >= 1) return 'danger';
  if (ratio >= 0.85) return 'warning';
  return 'safe';
}

export function getSmokeWarningLevel(totalSmoke: number, maxSmoke: number): 'safe' | 'warning' | 'danger' {
  const ratio = totalSmoke / maxSmoke;
  if (ratio >= 1) return 'danger';
  if (ratio >= 0.7) return 'warning';
  return 'safe';
}

export function shouldTriggerComplaint(
  totalSmoke: number,
  maxSmoke: number,
  consecutiveRounds: number
): boolean {
  const ratio = totalSmoke / maxSmoke;
  return ratio >= 0.8 && consecutiveRounds >= 2;
}

export function calculateRoundMoney(
  stalls: Stall[],
  baseEarning: number = 50,
  bonusMultiplier: number = 1
): number {
  const activeStalls = stalls.filter((s) => s.isOn).length;
  const avgPower = stalls.reduce((sum, s) => sum + (s.isOn ? s.power : 0), 0) / Math.max(1, activeStalls || 1);
  return Math.round(activeStalls * baseEarning * (avgPower / 100) * bonusMultiplier);
}

export function createStallsFromConfig(level: LevelConfig): Stall[] {
  return level.stallConfigs.map((config, index) => ({
    id: `stall_${index + 1}`,
    name: config.name,
    type: config.type,
    position: { ...config.position },
    power: 50,
    maxPower: config.maxPower,
    smokeCoefficient: config.smokeCoefficient,
    exhaustLevel: 1,
    isOn: true,
    smokeOutput: 0,
    color: config.color,
    emoji: config.emoji,
  }));
}