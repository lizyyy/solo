export function wavelengthToColor(wavelength: number): string {
  let r = 0, g = 0, b = 0;
  const factor = 1.0;

  if (wavelength >= 380 && wavelength < 440) {
    r = -(wavelength - 440) / (440 - 380);
    g = 0;
    b = 1;
  } else if (wavelength >= 440 && wavelength < 490) {
    r = 0;
    g = (wavelength - 440) / (490 - 440);
    b = 1;
  } else if (wavelength >= 490 && wavelength < 510) {
    r = 0;
    g = 1;
    b = -(wavelength - 510) / (510 - 490);
  } else if (wavelength >= 510 && wavelength < 580) {
    r = (wavelength - 510) / (580 - 510);
    g = 1;
    b = 0;
  } else if (wavelength >= 580 && wavelength < 645) {
    r = 1;
    g = -(wavelength - 645) / (645 - 580);
    b = 0;
  } else if (wavelength >= 645 && wavelength <= 780) {
    r = 1;
    g = 0;
    b = 0;
  }

  if (wavelength > 700) {
    const factor2 = 0.3 + 0.7 * (780 - wavelength) / (780 - 700);
    r *= factor2;
  } else if (wavelength < 420) {
    const factor2 = 0.3 + 0.7 * (wavelength - 380) / (420 - 380);
    r *= factor2;
    b *= factor2;
  }

  r = Math.round(r * 255 * factor);
  g = Math.round(g * 255 * factor);
  b = Math.round(b * 255 * factor);

  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export function getWavelengthRange(wavelength: number): string {
  if (wavelength < 400) return '紫外线';
  if (wavelength < 450) return '紫光';
  if (wavelength < 495) return '蓝光';
  if (wavelength < 570) return '绿光';
  if (wavelength < 590) return '黄光';
  if (wavelength < 620) return '橙光';
  if (wavelength <= 750) return '红光';
  return '红外线';
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export function colorDistance(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) return Infinity;
  
  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
}

export function calculateWavelength(fromEnergy: number, toEnergy: number): number {
  const energyDiff = Math.abs(fromEnergy - toEnergy);
  const hc = 1239.8;
  return hc / energyDiff;
}

export function formatDate(date: Date): string {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
