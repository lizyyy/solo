export const getThicknessColor = (thickness: number, threshold: number): string => {
  const ratio = thickness / threshold;
  if (ratio < 0.7) return '#ef4444';
  if (ratio < 0.85) return '#f59e0b';
  if (ratio < 1.0) return '#eab308';
  if (ratio < 1.2) return '#22c55e';
  if (ratio < 1.5) return '#06b6d4';
  return '#3b82f6';
};

export const getTemperatureColor = (temp: number, warning: number, critical: number): string => {
  if (temp >= critical) return '#ef4444';
  if (temp >= warning) return '#f59e0b';
  if (temp >= -2) return '#22c55e';
  if (temp >= -5) return '#06b6d4';
  return '#3b82f6';
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'normal': return '#22c55e';
    case 'warning': return '#f59e0b';
    case 'critical': return '#ef4444';
    case 'missing': return '#6b7280';
    default: return '#6b7280';
  }
};

export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : { r: 0.5, g: 0.5, b: 0.5 };
};

export const rgbToHex = (r: number, g: number, b: number): string => {
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
  );
};

export const interpolateColor = (color1: string, color2: string, t: number): string => {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  return rgbToHex(
    c1.r + (c2.r - c1.r) * t,
    c1.g + (c2.g - c1.g) * t,
    c1.b + (c2.b - c1.b) * t
  );
};
