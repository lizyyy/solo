
import { ScoreResult, Grade, IssueDetected } from '../types';
import { rgbToLab, calculateDeltaE, calculateBrightness } from './colorMath';

export function calculateScore(
  sourceData: ImageData,
  targetData: ImageData
): ScoreResult {
  const sourcePixels = sourceData.data;
  const targetPixels = targetData.data;
  const pixelCount = sourcePixels.length / 4;

  let brightnessDiff = 0;
  let colorDiff = 0;
  let detailDiff = 0;

  const sampleRate = Math.max(1, Math.floor(pixelCount / 10000));
  let sampledCount = 0;

  for (let i = 0; i < sourcePixels.length; i += 4 * sampleRate) {
    const sr = sourcePixels[i];
    const sg = sourcePixels[i + 1];
    const sb = sourcePixels[i + 2];

    const tr = targetPixels[i];
    const tg = targetPixels[i + 1];
    const tb = targetPixels[i + 2];

    const sBrightness = calculateBrightness(sr, sg, sb);
    const tBrightness = calculateBrightness(tr, tg, tb);
    brightnessDiff += Math.abs(sBrightness - tBrightness);

    const sLab = rgbToLab(sr, sg, sb);
    const tLab = rgbToLab(tr, tg, tb);
    colorDiff += calculateDeltaE(sLab, tLab);

    sampledCount++;
  }

  brightnessDiff /= sampledCount;
  colorDiff /= sampledCount;

  const brightnessScore = Math.max(0, 100 - brightnessDiff * 2);
  const colorScore = Math.max(0, 100 - colorDiff * 5);
  const detailScore = (brightnessScore + colorScore) / 2;

  const overallScore = brightnessScore * 0.4 + colorScore * 0.4 + detailScore * 0.2;

  return {
    overall: Math.round(overallScore * 10) / 10,
    brightness: Math.round(brightnessScore * 10) / 10,
    color: Math.round(colorScore * 10) / 10,
    detail: Math.round(detailScore * 10) / 10,
    grade: getGrade(overallScore),
    issues: [],
  };
}

export function getGrade(score: number): Grade {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

export function getGradeColor(grade: Grade): string {
  switch (grade) {
    case 'S': return '#00ff88';
    case 'A': return '#00d4ff';
    case 'B': return '#ffd700';
    case 'C': return '#ff6b35';
    case 'D': return '#ff3333';
  }
}

export function getIssueIcon(type: string): string {
  switch (type) {
    case 'skin_shift': return '👤';
    case 'shadows_clipped': return '🌑';
    case 'lut_overdose': return '🎨';
    default: return '⚠️';
  }
}

export function getIssueName(type: string): string {
  switch (type) {
    case 'skin_shift': return '肤色偏移';
    case 'shadows_clipped': return '暗部压死';
    case 'lut_overdose': return 'LUT叠加过度';
    default: return '未知问题';
  }
}
