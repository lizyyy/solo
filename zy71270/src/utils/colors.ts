export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): RGB {
  const cleaned = hex.replace('#', '');
  const num = parseInt(cleaned, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function densityToColor(density: number): RGB {
  const clamped = Math.min(1, Math.max(0, density));
  if (clamped < 0.5) {
    const t = clamped * 2;
    return {
      r: Math.round(0 + t * 255),
      g: Math.round(255 - t * 165),
      b: Math.round(255 - t * 255),
    };
  }
  const t = (clamped - 0.5) * 2;
  return {
    r: 255,
    g: Math.round(90 - t * 90),
    b: 0,
  };
}

export function congestionToColor(congestion: number): RGB {
  const clamped = Math.min(1, Math.max(0, congestion));
  if (clamped < 0.5) {
    const t = clamped * 2;
    return {
      r: Math.round(50 + t * 205),
      g: Math.round(200 - t * 100),
      b: Math.round(50),
    };
  }
  const t = (clamped - 0.5) * 2;
  return {
    r: 255,
    g: Math.round(100 - t * 100),
    b: Math.round(50 - t * 50),
  };
}

const statusColorMap: Record<string, RGB> = {
  idle: { r: 144, g: 238, b: 144 },
  working: { r: 65, g: 105, b: 225 },
  charging: { r: 255, g: 215, b: 0 },
  error: { r: 255, g: 69, b: 58 },
  moving: { r: 65, g: 105, b: 225 },
  waiting: { r: 255, g: 165, b: 0 },
  picking: { r: 138, g: 43, b: 226 },
};

export function statusToColor(status: string): RGB {
  return statusColorMap[status] ?? { r: 180, g: 180, b: 180 };
}
