export function calculateGravityFromPeriod(length: number, period: number, angle = 0): number {
  const angleRad = (angle * Math.PI) / 180;
  const correction = 1 + Math.pow(angleRad, 2) / 16;
  return (4 * Math.PI * Math.PI * length) / (period * period) * correction;
}

export function calculatePeriodFromGravity(length: number, gravity: number, angle = 0): number {
  const angleRad = (angle * Math.PI) / 180;
  const correction = 1 + Math.pow(angleRad, 2) / 16;
  return 2 * Math.PI * Math.sqrt(length / gravity) * correction;
}

export function largeAngleCorrection(angle: number, order = 2): number {
  const angleRad = (angle * Math.PI) / 180;
  let correction = 1;
  
  for (let n = 1; n <= order; n++) {
    const term = Math.pow(doubleFactorial(2 * n - 1) / doubleFactorial(2 * n), 2);
    correction += term * Math.pow(Math.sin(angleRad / 2), 2 * n);
  }
  
  return correction;
}

function doubleFactorial(n: number): number {
  if (n <= 1) return 1;
  return n * doubleFactorial(n - 2);
}

export function gravityUncertainty(
  length: number,
  period: number,
  lengthUncertainty: number,
  periodUncertainty: number,
  n: number
): number {
  const relativeLength = lengthUncertainty / length;
  const relativePeriod = 2 * periodUncertainty / (period * Math.sqrt(n));
  return Math.sqrt(relativeLength * relativeLength + relativePeriod * relativePeriod);
}

export interface GravityResult {
  value: number;
  uncertainty: number;
  unit: string;
}

export function calculateAverageGravity(lengths: number[], periods: number[]): GravityResult {
  if (lengths.length !== periods.length || lengths.length === 0) {
    return { value: 0, uncertainty: 0, unit: 'm/s²' };
  }
  
  const gravities = lengths.map((L, i) => calculateGravityFromPeriod(L, periods[i]));
  
  const meanG = gravities.reduce((a, b) => a + b, 0) / gravities.length;
  const variance = gravities.reduce((sum, g) => sum + Math.pow(g - meanG, 2), 0) / (gravities.length - 1);
  const stdDev = Math.sqrt(variance);
  const stdError = stdDev / Math.sqrt(gravities.length);
  
  return {
    value: meanG,
    uncertainty: stdError,
    unit: 'm/s²',
  };
}
