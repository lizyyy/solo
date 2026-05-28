import * as THREE from 'three';

export const SPHERE_RADIUS = 2;

export function hslTo3DPosition(
  hue: number,
  saturation: number,
  lightness: number,
  sphereRadius: number = SPHERE_RADIUS
): THREE.Vector3 {
  const theta = (hue / 360) * Math.PI * 2;
  const phi = (1 - lightness / 100) * Math.PI;
  const r = (saturation / 100) * sphereRadius;

  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.cos(phi);
  const z = r * Math.sin(phi) * Math.sin(theta);

  return new THREE.Vector3(x, y, z);
}

export function positionToHSL(position: THREE.Vector3, sphereRadius: number = SPHERE_RADIUS): { hue: number; saturation: number; lightness: number } {
  const r = position.length();
  const saturation = Math.min(100, (r / sphereRadius) * 100);
  
  const phi = Math.acos(position.y / Math.max(r, 0.001));
  const lightness = (1 - phi / Math.PI) * 100;
  
  let theta = Math.atan2(position.z, position.x);
  if (theta < 0) theta += Math.PI * 2;
  const hue = (theta / (Math.PI * 2)) * 360;
  
  return { hue, saturation, lightness };
}

export function hslToHex(hue: number, saturation: number, lightness: number): number {
  const h = hue / 360;
  const s = saturation / 100;
  const l = lightness / 100;

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

  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
}

export function hslToCssString(hue: number, saturation: number, lightness: number): string {
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export function generateSpectrumColor(angle: number): number {
  return hslToHex(angle, 100, 50);
}
