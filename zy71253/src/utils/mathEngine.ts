export interface SystemParams {
  a: number;
  b: number;
  c: number;
  d: number;
}

export type EqType =
  | 'stable_node'
  | 'unstable_node'
  | 'saddle'
  | 'stable_spiral'
  | 'unstable_spiral'
  | 'center'
  | 'degenerate';

export interface EigenResult {
  eigenvalues: [number, number];
  eigenvectors: [[number, number], [number, number]];
  tr: number;
  det: number;
  discriminant: number;
}

export interface EquilibriumPoint {
  id: string;
  x: number;
  y: number;
  type: EqType;
  eigen: EigenResult;
}

export interface TrajectoryPoint {
  t: number;
  x: number;
  y: number;
}

export function computeEigen(p: SystemParams): EigenResult {
  const tr = p.a + p.d;
  const det = p.a * p.d - p.b * p.c;
  const disc = tr * tr - 4 * det;
  let eigenvalues: [number, number];
  let eigenvectors: [[number, number], [number, number]];

  if (disc >= 0) {
    const sqrtDisc = Math.sqrt(disc);
    const l1 = (tr + sqrtDisc) / 2;
    const l2 = (tr - sqrtDisc) / 2;
    eigenvalues = [l1, l2];
    const v1 = eigenvectorForLambda(p, l1);
    const v2 = eigenvectorForLambda(p, l2);
    eigenvectors = [v1, v2];
  } else {
    const realPart = tr / 2;
    const imagPart = Math.sqrt(-disc) / 2;
    eigenvalues = [realPart, imagPart];
    eigenvectors = [
      [p.b, realPart - p.a],
      [realPart - p.d, p.c],
    ];
  }

  return { eigenvalues, eigenvectors, tr, det, discriminant: disc };
}

function eigenvectorForLambda(p: SystemParams, lambda: number): [number, number] {
  if (Math.abs(p.c) > 1e-10) {
    return [lambda - p.d, p.c];
  }
  if (Math.abs(p.b) > 1e-10) {
    return [p.b, lambda - p.a];
  }
  if (Math.abs(lambda - p.a) < 1e-10) {
    return [1, 0];
  }
  return [0, 1];
}

export function classifyEquilibrium(eigen: EigenResult): EqType {
  const { tr, det, discriminant } = eigen;

  if (Math.abs(det) < 1e-10) return 'degenerate';
  if (det < 0) return 'saddle';
  if (Math.abs(tr) < 1e-10 && det > 0) return 'center';
  if (discriminant >= 0) {
    return tr < 0 ? 'stable_node' : 'unstable_node';
  }
  return tr < 0 ? 'stable_spiral' : 'unstable_spiral';
}

export function findEquilibria(p: SystemParams): EquilibriumPoint[] {
  const eigen = computeEigen(p);
  const type = classifyEquilibrium(eigen);
  return [
    {
      id: 'origin',
      x: 0,
      y: 0,
      type,
      eigen,
    },
  ];
}

export function systemDerivative(
  p: SystemParams,
  _t: number,
  x: number,
  y: number
): [number, number] {
  return [p.a * x + p.b * y, p.c * x + p.d * y];
}

export function eulerStep(
  p: SystemParams,
  t: number,
  x: number,
  y: number,
  dt: number
): [number, number, number] {
  const [dx, dy] = systemDerivative(p, t, x, y);
  return [t + dt, x + dt * dx, y + dt * dy];
}

export function rk4Step(
  p: SystemParams,
  t: number,
  x: number,
  y: number,
  dt: number
): [number, number, number] {
  const [k1x, k1y] = systemDerivative(p, t, x, y);
  const [k2x, k2y] = systemDerivative(p, t + dt / 2, x + (dt * k1x) / 2, y + (dt * k1y) / 2);
  const [k3x, k3y] = systemDerivative(p, t + dt / 2, x + (dt * k2x) / 2, y + (dt * k2y) / 2);
  const [k4x, k4y] = systemDerivative(p, t + dt, x + dt * k3x, y + dt * k3y);
  return [
    t + dt,
    x + (dt * (k1x + 2 * k2x + 2 * k3x + k4x)) / 6,
    y + (dt * (k1y + 2 * k2y + 2 * k3y + k4y)) / 6,
  ];
}

export const DIVERGENCE_THRESHOLD = 100;

export function computeTrajectory(
  p: SystemParams,
  x0: number,
  y0: number,
  method: 'euler' | 'rk4',
  dt: number,
  tMax: number
): { points: TrajectoryPoint[]; diverged: boolean } {
  const stepFn = method === 'euler' ? eulerStep : rk4Step;
  const maxSteps = Math.min(Math.ceil(tMax / Math.abs(dt)), 2000);
  const points: TrajectoryPoint[] = [{ t: 0, x: x0, y: y0 }];
  let t = 0;
  let x = x0;
  let y = y0;
  let diverged = false;

  for (let i = 0; i < maxSteps; i++) {
    [t, x, y] = stepFn(p, t, x, y, dt);
    if (Math.abs(x) > DIVERGENCE_THRESHOLD || Math.abs(y) > DIVERGENCE_THRESHOLD || !isFinite(x) || !isFinite(y)) {
      diverged = true;
      points.push({ t, x: Math.max(-DIVERGENCE_THRESHOLD, Math.min(DIVERGENCE_THRESHOLD, x)), y: Math.max(-DIVERGENCE_THRESHOLD, Math.min(DIVERGENCE_THRESHOLD, y)) });
      break;
    }
    points.push({ t, x, y });
    if (t >= tMax) break;
  }

  return { points, diverged };
}

export function computeVectorField(
  p: SystemParams,
  range: number,
  gridN: number
): { x: number; y: number; dx: number; dy: number }[] {
  const field: { x: number; y: number; dx: number; dy: number }[] = [];
  const step = (2 * range) / (gridN - 1);
  for (let i = 0; i < gridN; i++) {
    for (let j = 0; j < gridN; j++) {
      const x = -range + i * step;
      const y = -range + j * step;
      const [dx, dy] = systemDerivative(p, 0, x, y);
      const mag = Math.sqrt(dx * dx + dy * dy);
      const norm = mag > 1e-10 ? Math.min(mag, 1) / mag : 0;
      field.push({ x, y, dx: dx * norm, dy: dy * norm });
    }
  }
  return field;
}

export const EQ_TYPE_LABELS: Record<EqType, string> = {
  stable_node: '稳定结点',
  unstable_node: '不稳定结点',
  saddle: '鞍点',
  stable_spiral: '稳定焦点',
  unstable_spiral: '不稳定焦点',
  center: '中心',
  degenerate: '退化',
};

export const EQ_TYPE_COLORS: Record<EqType, string> = {
  stable_node: '#00D4AA',
  unstable_node: '#FF6B4A',
  saddle: '#FFB84D',
  stable_spiral: '#00AACC',
  unstable_spiral: '#FF4488',
  center: '#AABBFF',
  degenerate: '#888888',
};
