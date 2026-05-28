
import { ColorParams, IssueDetected } from '../types';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function kelvinToRGB(kelvin: number): { r: number; g: number; b: number } {
  const temp = kelvin / 100;
  let r: number, g: number, b: number;

  if (temp <= 66) {
    r = 255;
    g = temp;
    g = 99.4708025861 * Math.log(g) - 161.1195681661;
    if (temp <= 19) {
      b = 0;
    } else {
      b = temp - 10;
      b = 138.5177312231 * Math.log(b) - 305.0447927307;
    }
  } else {
    r = temp - 60;
    r = 329.698727446 * Math.pow(r, -0.1332047592);
    g = temp - 60;
    g = 288.1221695283 * Math.pow(g, -0.0755148492);
    b = 255;
  }

  return {
    r: clamp(r, 0, 255),
    g: clamp(g, 0, 255),
    b: clamp(b, 0, 255),
  };
}

export function applyExposure(pixel: { r: number; g: number; b: number }, exposure: number): {
  r: number;
  g: number;
  b: number;
} {
  const factor = Math.pow(2, exposure);
  return {
    r: clamp(pixel.r * factor, 0, 255),
    g: clamp(pixel.g * factor, 0, 255),
    b: clamp(pixel.b * factor, 0, 255),
  };
}

export function applyWhiteBalance(
  pixel: { r: number; g: number; b: number },
  temperature: number
): { r: number; g: number; b: number } {
  const wb = kelvinToRGB(temperature);
  const neutral = kelvinToRGB(6500);

  const rGain = neutral.r / wb.r;
  const gGain = neutral.g / wb.g;
  const bGain = neutral.b / wb.b;

  return {
    r: clamp(pixel.r * rGain, 0, 255),
    g: clamp(pixel.g * gGain, 0, 255),
    b: clamp(pixel.b * bGain, 0, 255),
  };
}

export function applyColorGrading(
  pixel: { r: number; g: number; b: number },
  params: ColorParams,
  lutData?: number[][][][]
): { r: number; g: number; b: number } {
  let result = { ...pixel };

  result = applyExposure(result, params.exposure);
  result = applyWhiteBalance(result, params.temperature);

  if (lutData && params.lutId && params.lutIntensity > 0) {
    const lutResult = applyLUT(result, lutData);
    const intensity = params.lutIntensity / 100;
    result = {
      r: result.r + (lutResult.r - result.r) * intensity,
      g: result.g + (lutResult.g - result.g) * intensity,
      b: result.b + (lutResult.b - result.b) * intensity,
    };
  }

  return {
    r: Math.round(result.r),
    g: Math.round(result.g),
    b: Math.round(result.b),
  };
}

export function applyLUT(
  pixel: { r: number; g: number; b: number },
  lutData: number[][][][]
): { r: number; g: number; b: number } {
  const size = lutData.length;
  const maxIndex = size - 1;

  const rNorm = pixel.r / 255 * maxIndex;
  const gNorm = pixel.g / 255 * maxIndex;
  const bNorm = pixel.b / 255 * maxIndex;

  const r0 = Math.floor(rNorm);
  const g0 = Math.floor(gNorm);
  const b0 = Math.floor(bNorm);
  const r1 = Math.min(r0 + 1, maxIndex);
  const g1 = Math.min(g0 + 1, maxIndex);
  const b1 = Math.min(b0 + 1, maxIndex);

  const rFrac = rNorm - r0;
  const gFrac = gNorm - g0;
  const bFrac = bNorm - b0;

  const c000 = lutData[r0][g0][b0];
  const c100 = lutData[r1][g0][b0];
  const c010 = lutData[r0][g1][b0];
  const c110 = lutData[r1][g1][b0];
  const c001 = lutData[r0][g0][b1];
  const c101 = lutData[r1][g0][b1];
  const c011 = lutData[r0][g1][b1];
  const c111 = lutData[r1][g1][b1];

  const channels = [0, 1, 2] as const;
  const result = channels.map((ch) => {
    const v000 = c000[ch], v100 = c100[ch], v010 = c010[ch], v110 = c110[ch];
    const v001 = c001[ch], v101 = c101[ch], v011 = c011[ch], v111 = c111[ch];

    const c00 = v000 + (v100 - v000) * rFrac;
    const c10 = v010 + (v110 - v010) * rFrac;
    const c01 = v001 + (v101 - v001) * rFrac;
    const c11 = v011 + (v111 - v011) * rFrac;

    const c0 = c00 + (c10 - c00) * gFrac;
    const c1 = c01 + (c11 - c01) * gFrac;

    return clamp(c0 + (c1 - c0) * bFrac, 0, 255);
  });

  return { r: result[0], g: result[1], b: result[2] };
}

export function rgbToLab(r: number, g: number, b: number): { l: number; a: number; b: number } {
  let rNorm = r / 255;
  let gNorm = g / 255;
  let bNorm = b / 255;

  rNorm = rNorm > 0.04045 ? Math.pow((rNorm + 0.055) / 1.055, 2.4) : rNorm / 12.92;
  gNorm = gNorm > 0.04045 ? Math.pow((gNorm + 0.055) / 1.055, 2.4) : gNorm / 12.92;
  bNorm = bNorm > 0.04045 ? Math.pow((bNorm + 0.055) / 1.055, 2.4) : bNorm / 12.92;

  let x = rNorm * 0.4124 + gNorm * 0.3576 + bNorm * 0.1805;
  let y = rNorm * 0.2126 + gNorm * 0.7152 + bNorm * 0.0722;
  let z = rNorm * 0.0193 + gNorm * 0.1192 + bNorm * 0.9505;

  x /= 0.95047;
  y /= 1.00000;
  z /= 1.08883;

  x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

  return {
    l: 116 * y - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  };
}

export function calculateDeltaE(
  lab1: { l: number; a: number; b: number },
  lab2: { l: number; a: number; b: number }
): number {
  return Math.sqrt(
    Math.pow(lab1.l - lab2.l, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  );
}

export function calculateBrightness(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function isSkinTone(r: number, g: number, b: number): boolean {
  const y = calculateBrightness(r, g, b);
  if (y < 40 || y > 220) return false;

  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

  return cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;
}

export function calculateSkinToneShift(
  imageData: ImageData,
  referenceData?: ImageData
): { hasShift: boolean; shiftAmount: number; skinPixelRatio: number } {
  const data = imageData.data;
  const refData = referenceData?.data;

  let skinPixelCount = 0;
  let totalShift = 0;
  let totalSkinPixelsInRef = 0;

  const sampleRate = Math.max(1, Math.floor((data.length / 4) / 5000));
  let sampledCount = 0;

  for (let i = 0; i < data.length; i += 4 * sampleRate) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    sampledCount++;

    if (isSkinTone(r, g, b)) {
      skinPixelCount++;

      if (refData && i < refData.length) {
        const refR = refData[i];
        const refG = refData[i + 1];
        const refB = refData[i + 2];

        if (isSkinTone(refR, refG, refB)) {
          totalSkinPixelsInRef++;
          const lab1 = rgbToLab(r, g, b);
          const lab2 = rgbToLab(refR, refG, refB);
          totalShift += calculateDeltaE(lab1, lab2);
        }
      }
    }
  }

  const skinPixelRatio = skinPixelCount / sampledCount;
  const avgShift = totalSkinPixelsInRef > 0 ? totalShift / totalSkinPixelsInRef : 0;

  if (referenceData && skinPixelRatio > 0.05) {
    return {
      hasShift: avgShift > 8,
      shiftAmount: avgShift,
      skinPixelRatio,
    };
  }

  return {
    hasShift: false,
    shiftAmount: avgShift,
    skinPixelRatio,
  };
}

export function detectIssues(
  imageData: ImageData,
  params: ColorParams,
  referenceData?: ImageData
): IssueDetected[] {
  const issues: IssueDetected[] = [];
  const data = imageData.data;

  let darkPixelCount = 0;
  let totalSaturation = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const brightness = calculateBrightness(r, g, b);
    if (brightness < 20) {
      darkPixelCount++;
    }

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max > 0 ? (max - min) / max : 0;
    totalSaturation += saturation;
  }

  const pixelCount = data.length / 4;
  const darkPixelRatio = darkPixelCount / pixelCount;
  const avgSaturation = totalSaturation / pixelCount;

  if (darkPixelRatio > 0.3) {
    issues.push({
      type: 'shadows_clipped',
      severity: darkPixelRatio > 0.4 ? 'error' : 'warning',
      message: `暗部细节丢失严重 (${(darkPixelRatio * 100).toFixed(1)}% 像素接近纯黑)`,
      value: darkPixelRatio,
    });
  }

  if (params.lutIntensity > 80 && avgSaturation > 0.6) {
    issues.push({
      type: 'lut_overdose',
      severity: params.lutIntensity > 90 ? 'error' : 'warning',
      message: `LUT强度过高，色彩可能失真 (强度: ${params.lutIntensity}%)`,
      value: params.lutIntensity,
    });
  }

  if (referenceData) {
    const skinAnalysis = calculateSkinToneShift(imageData, referenceData);
    if (skinAnalysis.hasShift && skinAnalysis.skinPixelRatio > 0.05) {
      issues.push({
        type: 'skin_shift',
        severity: skinAnalysis.shiftAmount > 15 ? 'error' : 'warning',
        message: `肤色偏移检测 (ΔE: ${skinAnalysis.shiftAmount.toFixed(1)})`,
        value: skinAnalysis.shiftAmount,
      });
    }
  }

  return issues;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
