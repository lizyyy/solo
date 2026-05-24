import { RGBA } from './types';

export function hexToRgba(hex: string): RGBA | null {
  const cleanHex = hex.replace('#', '');
  
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return { r, g, b, a: 1 };
  }
  
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);
    return { r, g, b, a: 1 };
  }
  
  if (cleanHex.length === 8) {
    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);
    const a = parseInt(cleanHex.slice(6, 8), 16) / 255;
    return { r, g, b, a };
  }
  
  return null;
}

export function rgbaToHex(rgba: RGBA): string {
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  const hex = `#${toHex(rgba.r)}${toHex(rgba.g)}${toHex(rgba.b)}`;
  
  if (rgba.a < 1) {
    return `${hex}${toHex(Math.round(rgba.a * 255))}`;
  }
  
  return hex;
}

export function parseRgbaString(str: string): RGBA | null {
  const rgbaMatch = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
      a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1
    };
  }
  
  const hslaMatch = str.match(/hsla?\((\d+),\s*([\d.]+)%,\s*([\d.]+)%(?:,\s*([\d.]+))?\)/);
  if (hslaMatch) {
    const h = parseInt(hslaMatch[1], 10) / 360;
    const s = parseFloat(hslaMatch[2]) / 100;
    const l = parseFloat(hslaMatch[3]) / 100;
    const a = hslaMatch[4] ? parseFloat(hslaMatch[4]) : 1;
    return hslToRgb(h, s, l, a);
  }
  
  return null;
}

export function hslToRgb(h: number, s: number, l: number, a: number = 1): RGBA {
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
    a
  };
}

export function parseColor(colorStr: string): RGBA | null {
  if (colorStr.startsWith('#')) {
    return hexToRgba(colorStr);
  }
  
  if (colorStr.startsWith('rgb')) {
    return parseRgbaString(colorStr);
  }
  
  if (colorStr.startsWith('hsl')) {
    return parseRgbaString(colorStr);
  }
  
  return null;
}

export function blendAlpha(foreground: RGBA, background: RGBA): RGBA {
  if (foreground.a === 1) {
    return foreground;
  }
  
  const a = foreground.a + background.a * (1 - foreground.a);
  
  if (a === 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  
  return {
    r: Math.round((foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / a),
    g: Math.round((foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / a),
    b: Math.round((foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / a),
    a
  };
}

export function getLuminance(rgba: RGBA): number {
  const srgb = [rgba.r / 255, rgba.g / 255, rgba.b / 255];
  const [r, g, b] = srgb.map(c => 
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function getContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isLightColor(rgba: RGBA): boolean {
  return getLuminance(rgba) > 0.179;
}

export function normalizeColor(color: string): string {
  const rgba = parseColor(color);
  if (!rgba) return color;
  return rgbaToHex(rgba);
}
