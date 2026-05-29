import { ColorSample, ColorIssue, ColorAnalysisResult, IssueSeverity } from '../types';
import { generateId, calculateColorEntropy, isGrayish, isOverSaturated } from '../utils/color';

interface AnalysisOptions {
  entropyThreshold?: number;
  grayThreshold?: number;
  overSaturationThreshold?: number;
}

export function analyzeColorQuality(
  colors: ColorSample[],
  versionId: string,
  options: AnalysisOptions = {}
): ColorAnalysisResult {
  const {
    entropyThreshold = 2.0,
    grayThreshold = 40,
    overSaturationThreshold = 25
  } = options;

  const issues: ColorIssue[] = [];
  const validColors = colors.filter(c => !c.isBackground && !c.isExtreme);

  const colorEntropy = calculateColorEntropy(validColors);
  const grayPercentage = validColors
    .filter(c => isGrayish(c.rgb_r, c.rgb_g, c.rgb_b))
    .reduce((s, c) => s + c.percentage, 0);
  const overSaturatedPercentage = validColors
    .filter(c => isOverSaturated(c.rgb_r, c.rgb_g, c.rgb_b))
    .reduce((s, c) => s + c.percentage, 0);
  const averageSaturation = validColors.length > 0
    ? validColors.reduce((s, c) => s + c.hsl_s, 0) / validColors.length
    : 0;

  if (colorEntropy < entropyThreshold) {
    const severity: IssueSeverity = colorEntropy < 1.0 ? 'high' : colorEntropy < 1.5 ? 'medium' : 'low';
    const dominantColor = validColors[0];
    
    issues.push({
      id: generateId(),
      versionId,
      type: 'duplicate',
      severity,
      colorHex: dominantColor?.hex || '#888888',
      percentage: Math.round((1 - colorEntropy / 3) * 100),
      pos_x: dominantColor?.clusterPixels?.[0]?.x || 0,
      pos_y: dominantColor?.clusterPixels?.[0]?.y || 0,
      width: 50,
      height: 50,
      description: `配色过于单一，颜色熵值仅 ${colorEntropy.toFixed(2)}（建议 > ${entropyThreshold}）`,
      affectedPixels: dominantColor?.pixelCount
    });
  }

  if (grayPercentage > grayThreshold) {
    const severity: IssueSeverity = grayPercentage > 60 ? 'high' : grayPercentage > 50 ? 'medium' : 'low';
    const grayestColor = validColors
      .filter(c => isGrayish(c.rgb_r, c.rgb_g, c.rgb_b))
      .sort((a, b) => a.hsl_s - b.hsl_s)[0];

    issues.push({
      id: generateId(),
      versionId,
      type: 'gray',
      severity,
      colorHex: grayestColor?.hex || '#888888',
      percentage: Math.round(grayPercentage * 100) / 100,
      pos_x: grayestColor?.clusterPixels?.[0]?.x || 0,
      pos_y: grayestColor?.clusterPixels?.[0]?.y || 0,
      width: 60,
      height: 60,
      description: `画面偏灰，低饱和度颜色占比 ${grayPercentage.toFixed(1)}%（建议 < ${grayThreshold}%）`,
      affectedPixels: Math.round(validColors.reduce((s, c) => s + (isGrayish(c.rgb_r, c.rgb_g, c.rgb_b) ? c.pixelCount : 0), 0))
    });
  }

  if (overSaturatedPercentage > overSaturationThreshold) {
    const severity: IssueSeverity = overSaturatedPercentage > 40 ? 'high' : overSaturatedPercentage > 30 ? 'medium' : 'low';
    const mostSaturated = validColors
      .filter(c => isOverSaturated(c.rgb_r, c.rgb_g, c.rgb_b))
      .sort((a, b) => b.hsl_s - a.hsl_s)[0];

    issues.push({
      id: generateId(),
      versionId,
      type: 'over_saturated',
      severity,
      colorHex: mostSaturated?.hex || '#ff0000',
      percentage: Math.round(overSaturatedPercentage * 100) / 100,
      pos_x: mostSaturated?.clusterPixels?.[0]?.x || 0,
      pos_y: mostSaturated?.clusterPixels?.[0]?.y || 0,
      width: 55,
      height: 55,
      description: `色彩过于饱和，高饱和度颜色占比 ${overSaturatedPercentage.toFixed(1)}%（建议 < ${overSaturationThreshold}%）`,
      affectedPixels: Math.round(validColors.reduce((s, c) => s + (isOverSaturated(c.rgb_r, c.rgb_g, c.rgb_b) ? c.pixelCount : 0), 0))
    });
  }

  const baseScore = 100;
  let deductions = 0;

  for (const issue of issues) {
    const severityDeduction = { low: 5, medium: 15, high: 25 }[issue.severity];
    deductions += severityDeduction;
  }

  const varietyBonus = Math.min(validColors.length * 2, 10);
  const overallScore = Math.max(0, Math.min(100, baseScore - deductions + varietyBonus));

  return {
    dominantColors: colors,
    issues,
    overallScore: Math.round(overallScore),
    metrics: {
      colorEntropy,
      grayPercentage: Math.round(grayPercentage * 100) / 100,
      overSaturatedPercentage: Math.round(overSaturatedPercentage * 100) / 100,
      averageSaturation: Math.round(averageSaturation * 100) / 100,
      colorVariety: validColors.length
    }
  };
}

export function getIssueTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    duplicate: '配色重复',
    gray: '画面偏灰',
    over_saturated: '色彩过饱和'
  };
  return labels[type] || type;
}

export function getSeverityLabel(severity: IssueSeverity): string {
  const labels: Record<IssueSeverity, string> = {
    low: '轻度',
    medium: '中度',
    high: '严重'
  };
  return labels[severity];
}

export function getSeverityColor(severity: IssueSeverity): string {
  const colors: Record<IssueSeverity, string> = {
    low: '#e9c46a',
    medium: '#d46c3a',
    high: '#bc4749'
  };
  return colors[severity];
}
