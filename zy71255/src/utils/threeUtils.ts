import * as THREE from 'three';
import type { RGB } from './types';

const industryColors: Record<string, { hue: number; saturation: number; lightness: number }> = {
  '电力': { hue: 0, saturation: 0.85, lightness: 0.55 },
  '钢铁': { hue: 30, saturation: 0.8, lightness: 0.5 },
  '化工': { hue: 60, saturation: 0.75, lightness: 0.5 },
  '建材': { hue: 120, saturation: 0.7, lightness: 0.45 },
  '有色': { hue: 180, saturation: 0.75, lightness: 0.5 },
  '造纸': { hue: 210, saturation: 0.8, lightness: 0.55 },
  '航空': { hue: 270, saturation: 0.75, lightness: 0.6 },
  '其他': { hue: 300, saturation: 0.65, lightness: 0.5 }
};

export function getClusterPosition(
  industry: string,
  index: number,
  total: number,
  radius: number = 8
): THREE.Vector3 {
  const industryInfo = industryColors[industry] || industryColors['其他'];
  const angleOffset = (industryInfo.hue / 360) * Math.PI * 2;

  const angleStep = (Math.PI * 2) / Math.max(total, 1);
  const angle = angleOffset + index * angleStep;

  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const y = 0;

  return new THREE.Vector3(x, y, z);
}

export function createCurvePath(
  start: THREE.Vector3,
  end: THREE.Vector3,
  height: number = 3
): THREE.CatmullRomCurve3 {
  const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  midPoint.y += height;

  const controlPoint1 = new THREE.Vector3().lerpVectors(start, midPoint, 0.5);
  controlPoint1.y += height * 0.3;

  const controlPoint2 = new THREE.Vector3().lerpVectors(midPoint, end, 0.5);
  controlPoint2.y += height * 0.3;

  const curve = new THREE.CatmullRomCurve3([
    start.clone(),
    controlPoint1,
    midPoint,
    controlPoint2,
    end.clone()
  ]);

  curve.curveType = 'catmullrom';
  curve.tension = 0.5;

  return curve;
}

export function getLineColor(
  amount: number,
  maxAmount: number,
  minHue: number = 120,
  maxHue: number = 0
): THREE.Color {
  const normalizedAmount = maxAmount > 0 ? Math.min(Math.max(amount / maxAmount, 0), 1) : 0;
  const hue = minHue + (maxHue - minHue) * normalizedAmount;
  const saturation = 0.7 + normalizedAmount * 0.2;
  const lightness = 0.45 + normalizedAmount * 0.15;

  return new THREE.Color().setHSL(hue / 360, saturation, lightness);
}

export function lerpColor(
  color1: THREE.Color | string | number,
  color2: THREE.Color | string | number,
  t: number
): THREE.Color {
  const c1 = new THREE.Color(color1);
  const c2 = new THREE.Color(color2);
  const clampedT = Math.max(0, Math.min(1, t));

  return new THREE.Color().lerpColors(c1, c2, clampedT);
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}
