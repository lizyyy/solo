import { Cube3D } from '../types/data';

export const COLORS = {
  bid: {
    base: '#00d4ff',
    light: '#5ce1ff',
    dark: '#00a3cc',
    gradient: ['#006680', '#00d4ff', '#66e5ff'],
  },
  ask: {
    base: '#ff4757',
    light: '#ff7782',
    dark: '#cc3a46',
    gradient: ['#80242c', '#ff4757', '#ff8a94'],
  },
  anomaly: {
    base: '#ff3366',
    pulse: ['#ff3366', '#ff6699', '#ff3366'],
  },
  selection: {
    base: '#ffc107',
    glow: '#ffd54f',
  },
  neutral: {
    grid: '#1a1f2e',
    axis: '#3d4a5c',
    text: '#8fa3b8',
    background: '#0f1419',
    panel: 'rgba(15, 20, 25, 0.85)',
  },
} as const;

export function interpolateColor(color1: string, color2: string, factor: number): string {
  const hex = (x: string) => parseInt(x, 16);
  const r1 = hex(color1.slice(1, 3));
  const g1 = hex(color1.slice(3, 5));
  const b1 = hex(color1.slice(5, 7));
  const r2 = hex(color2.slice(1, 3));
  const g2 = hex(color2.slice(3, 5));
  const b2 = hex(color2.slice(5, 7));
  
  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function getQuantityColor(
  quantity: number,
  minQty: number,
  maxQty: number,
  isBid: boolean
): string {
  const normalized = maxQty === minQty ? 0.5 : (quantity - minQty) / (maxQty - minQty);
  const colors = isBid ? COLORS.bid.gradient : COLORS.ask.gradient;
  
  if (normalized < 0.5) {
    return interpolateColor(colors[0], colors[1], normalized * 2);
  } else {
    return interpolateColor(colors[1], colors[2], (normalized - 0.5) * 2);
  }
}

export function getLevelOpacity(level: number, maxLevel: number): number {
  const baseOpacity = 0.85;
  const decayFactor = 0.92;
  return baseOpacity * Math.pow(decayFactor, level - 1);
}

export function getAnomalyColor(severity: number): string {
  const colors = ['#ffcccc', '#ff9999', '#ff6666', '#ff3333', '#cc0000'];
  return colors[Math.min(Math.max(0, severity - 1), 4)];
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : { r: 0, g: 0, b: 0 };
}

export function updateCubeColor(cube: Cube3D, minQty: number, maxQty: number): Cube3D {
  if (cube.isAnomaly) {
    return {
      ...cube,
      color: getAnomalyColor(cube.anomalySeverity),
      opacity: 0.95,
    };
  }
  return {
    ...cube,
    color: getQuantityColor(cube.quantity, minQty, maxQty, cube.isBid),
    opacity: getLevelOpacity(cube.level, 10),
  };
}
