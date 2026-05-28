import type { Lab } from '@/data/types';
import { hexToLab } from './colorSpace';

function deg2rad(d: number): number {
  return d * (Math.PI / 180);
}

function rad2deg(r: number): number {
  return r * (180 / Math.PI);
}

export function ciede2000(lab1: Lab, lab2: Lab): number {
  const L1 = lab1.L, a1 = lab1.a, b1 = lab1.b;
  const L2 = lab2.L, a2 = lab1.a !== undefined ? lab2.a : 0, b2 = lab2.b;

  const C1ab = Math.sqrt(a1 * a1 + b1 * b1);
  const C2ab = Math.sqrt(a2 * a2 + b2 * b2);
  const Cab7 = Math.pow((C1ab + C2ab) / 2, 7);

  const G = 0.5 * (1 - Math.sqrt(Cab7 / (Cab7 + Math.pow(25, 7))));

  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  let h1p = Math.atan2(b1, a1p);
  if (h1p < 0) h1p += 2 * Math.PI;
  h1p = rad2deg(h1p);

  let h2p = Math.atan2(b2, a2p);
  if (h2p < 0) h2p += 2 * Math.PI;
  h2p = rad2deg(h2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp = 0;
  if (C1p * C2p !== 0) {
    if (Math.abs(h2p - h1p) <= 180) {
      dhp = h2p - h1p;
    } else if (h2p - h1p > 180) {
      dhp = h2p - h1p - 360;
    } else {
      dhp = h2p - h1p + 360;
    }
  }

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(deg2rad(dhp / 2));

  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;

  let hbp = 0;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) {
      hbp = (h1p + h2p) / 2;
    } else if (h1p + h2p < 360) {
      hbp = (h1p + h2p + 360) / 2;
    } else {
      hbp = (h1p + h2p - 360) / 2;
    }
  }

  const T = 1
    - 0.17 * Math.cos(deg2rad(hbp - 30))
    + 0.24 * Math.cos(deg2rad(2 * hbp))
    + 0.32 * Math.cos(deg2rad(3 * hbp + 6))
    - 0.20 * Math.cos(deg2rad(4 * hbp - 63));

  const SL = 1 + 0.015 * Math.pow(Lbp - 50, 2) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
  const SC = 1 + 0.045 * Cbp;
  const SH = 1 + 0.015 * Cbp * T;

  const RT3 = -2 * Math.sqrt(Math.pow(Cbp, 7) / (Math.pow(Cbp, 7) + Math.pow(25, 7)));
  const dTheta = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2));
  const RC = 2 * RT3 * Math.sin(deg2rad(2 * dTheta));

  const kL = 1, kC = 1, kH = 1;

  const result = Math.sqrt(
    Math.pow(dLp / (kL * SL), 2) +
    Math.pow(dCp / (kC * SC), 2) +
    Math.pow(dHp / (kH * SH), 2) +
    RC * (dCp / (kC * SC)) * (dHp / (kH * SH))
  );

  return result;
}

export function ciede2000FromHex(hex1: string, hex2: string): number {
  const lab1 = hexToLab(hex1);
  const lab2 = hexToLab(hex2);
  return ciede2000(lab1, lab2);
}

export function computeHueDistance(h1: number, h2: number): number {
  const diff = Math.abs(h1 - h2);
  return Math.min(diff, 360 - diff);
}

export function computeComponentDistances(
  hsl1: { h: number; s: number; l: number },
  hsl2: { h: number; s: number; l: number }
): { hue: number; saturation: number; lightness: number } {
  return {
    hue: computeHueDistance(hsl1.h, hsl2.h),
    saturation: Math.abs(hsl1.s - hsl2.s),
    lightness: Math.abs(hsl1.l - hsl2.l),
  };
}
