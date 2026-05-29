import { getPixelAt } from '../utils/image';
import { rgbToHex, rgbToHsl, labColorDistance, rgbToLab } from '../utils/color';

interface BackgroundDetectionResult {
  isBackground: boolean;
  backgroundColor?: string;
  backgroundPercentage: number;
  excludedPixels: number;
}

export function detectBackgroundColor(imageData: ImageData): BackgroundDetectionResult {
  const { width, height, data } = imageData;
  const cornerPixels: Array<{ r: number; g: number; b: number }> = [];
  
  const corners = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: 0, y: height - 1 },
    { x: width - 1, y: height - 1 },
  ];

  for (const corner of corners) {
    const pixel = getPixelAt(imageData, corner.x, corner.y);
    if (pixel.a > 128) {
      cornerPixels.push({ r: pixel.r, g: pixel.g, b: pixel.b });
    }
  }

  if (cornerPixels.length < 3) {
    return {
      isBackground: false,
      backgroundPercentage: 0,
      excludedPixels: 0
    };
  }

  const avgR = Math.round(cornerPixels.reduce((s, p) => s + p.r, 0) / cornerPixels.length);
  const avgG = Math.round(cornerPixels.reduce((s, p) => s + p.g, 0) / cornerPixels.length);
  const avgB = Math.round(cornerPixels.reduce((s, p) => s + p.b, 0) / cornerPixels.length);

  const avgHsl = rgbToHsl(avgR, avgG, avgB);
  const avgLab = rgbToLab(avgR, avgG, avgB);

  let backgroundPixels = 0;
  const totalPixels = width * height;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 128) continue;

    const hsl = rgbToHsl(r, g, b);
    const lab = rgbToLab(r, g, b);

    const hslDistance = Math.sqrt(
      Math.pow(hsl.h - avgHsl.h, 2) / 360 +
      Math.pow(hsl.s - avgHsl.s, 2) / 100 +
      Math.pow(hsl.l - avgHsl.l, 2) / 100
    );

    const labDist = labColorDistance(lab, avgLab) / 100;
    const distance = (hslDistance + labDist) / 2;

    if (distance < 0.15) {
      backgroundPixels++;
    }
  }

  const percentage = (backgroundPixels / totalPixels) * 100;

  if (percentage > 30) {
    return {
      isBackground: true,
      backgroundColor: rgbToHex(avgR, avgG, avgB),
      backgroundPercentage: Math.round(percentage * 100) / 100,
      excludedPixels: backgroundPixels
    };
  }

  return {
    isBackground: false,
    backgroundPercentage: Math.round(percentage * 100) / 100,
    excludedPixels: 0
  };
}

export function isBackgroundPixel(
  r: number,
  g: number,
  b: number,
  backgroundLab: { l: number; a: number; b: number },
  threshold: number = 15
): boolean {
  const pixelLab = rgbToLab(r, g, b);
  return labColorDistance(pixelLab, backgroundLab) < threshold;
}
