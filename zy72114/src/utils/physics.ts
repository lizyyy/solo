export const g = 9.81;

export enum SafetyLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  DANGER = 'danger'
}

const THRESHOLDS = {
  low: 10,
  medium: 50,
  high: 200
};

function degToRad(deg: number): number {
  return deg * Math.PI / 180;
}

export function calculateFlightTime(v0: number, angleDeg: number, height: number): number {
  const rad = degToRad(angleDeg);
  const vy0 = v0 * Math.sin(rad);
  const discriminant = vy0 * vy0 + 2 * g * height;
  return (vy0 + Math.sqrt(discriminant)) / g;
}

export function calculateRange(v0: number, angleDeg: number, height: number): number {
  const rad = degToRad(angleDeg);
  const vx = v0 * Math.cos(rad);
  const t = calculateFlightTime(v0, angleDeg, height);
  return vx * t;
}

export function calculateMaxHeight(v0: number, angleDeg: number, height: number): number {
  const rad = degToRad(angleDeg);
  const vy0 = v0 * Math.sin(rad);
  return height + (vy0 * vy0) / (2 * g);
}

export function calculateKineticEnergy(mass: number, velocity: number): number {
  return 0.5 * mass * velocity * velocity;
}

export function calculateImpactEnergy(mass: number, v0: number, angleDeg: number, height: number): number {
  const initialKinetic = calculateKineticEnergy(mass, v0);
  const potential = mass * g * height;
  return initialKinetic + potential;
}

export function getSafetyThresholds(): { low: number; medium: number; high: number } {
  return { ...THRESHOLDS };
}

export function getSafetyLevel(energy: number): SafetyLevel {
  if (energy < THRESHOLDS.low) return SafetyLevel.LOW;
  if (energy < THRESHOLDS.medium) return SafetyLevel.MEDIUM;
  if (energy < THRESHOLDS.high) return SafetyLevel.HIGH;
  return SafetyLevel.DANGER;
}

export function getSafetyLevelLabel(level: SafetyLevel): string {
  const labels: Record<SafetyLevel, string> = {
    [SafetyLevel.LOW]: '安全',
    [SafetyLevel.MEDIUM]: '注意',
    [SafetyLevel.HIGH]: '危险',
    [SafetyLevel.DANGER]: '极度危险'
  };
  return labels[level];
}

export function getProcessingSuggestion(level: SafetyLevel): string {
  const suggestions: Record<SafetyLevel, string> = {
    [SafetyLevel.LOW]: '没问题，这个能量级别很安全，正常演示就行，记得提醒同学们站在安全区域外观看哈。',
    [SafetyLevel.MEDIUM]: '哎，这个能量有点偏高了。你最好调整一下发射角度或者减轻配重，现场安排两个同学维持秩序，确保没人靠近落点。',
    [SafetyLevel.HIGH]: '等等，这个能量级别太危险了！千万别直接试射。赶紧降低投石机的配重或者减小弹射力度，必须换一个更空旷的场地，周围至少5米内不能有人。',
    [SafetyLevel.DANGER]: '兄弟，这个能量已经严重超标了！绝对不能发射！立刻停止实验，重新设计方案，要么大幅减轻配重，要么缩小投石机尺寸，安全第一啊！'
  };
  return suggestions[level];
}
