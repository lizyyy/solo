import type { ShadingPeriod } from '../types';
import { getHourlyGenerationWeights } from './solarMath';

export function calculateShadingLoss(
  periods: ShadingPeriod[],
  latitude: number
): {
  lossPercent: number;
  reason: string;
} {
  const hourWeights = getHourlyGenerationWeights(latitude);
  let lossPercent = 0;
  const affectedHours: string[] = [];

  periods.forEach((period) => {
    for (let h = period.startHour; h < period.endHour; h++) {
      if (h >= 0 && h < 24) {
        lossPercent += hourWeights[h] * 100;
        if (hourWeights[h] > 0.01) {
          affectedHours.push(`${h}:00`);
        }
      }
    }
  });

  lossPercent = Math.round(lossPercent * 10) / 10;

  const periodDesc =
    periods.length > 0
      ? periods.map((p) => `${p.startHour}:00-${p.endHour}:00`).join('、')
      : '无';

  const reason = `基于各时段发电量权重分析：遮挡时段${periodDesc}，受影响时段${affectedHours.length > 0 ? affectedHours.slice(0, 4).join('、') : '无'}，累计发电损失约${lossPercent}%`;

  return {
    lossPercent,
    reason,
  };
}

export function validateShadingPeriods(periods: ShadingPeriod[]): {
  valid: boolean;
  warning?: string;
  overlapping: boolean;
  spansNoon: boolean;
} {
  let overlapping = false;
  let spansNoon = false;

  for (let i = 0; i < periods.length; i++) {
    const p1 = periods[i];

    if (p1.startHour <= 12 && p1.endHour > 12) {
      spansNoon = true;
    }

    for (let j = i + 1; j < periods.length; j++) {
      const p2 = periods[j];
      if (
        (p1.startHour < p2.endHour && p1.endHour > p2.startHour) ||
        (p2.startHour < p1.endHour && p2.endHour > p1.startHour)
      ) {
        overlapping = true;
      }
    }
  }

  let warning: string | undefined;
  if (overlapping) {
    warning = '遮挡时段存在重叠，计算结果可能不准确';
  } else if (spansNoon) {
    warning = '遮挡跨越正午时段，该时段发电效率最高，损失影响较大';
  }

  return {
    valid: !overlapping,
    warning,
    overlapping,
    spansNoon,
  };
}

export function getShadingImpactLevel(lossPercent: number): {
  level: 'low' | 'medium' | 'high' | 'critical';
  label: string;
  color: string;
} {
  if (lossPercent < 5) {
    return { level: 'low', label: '轻微影响', color: '#43a047' };
  } else if (lossPercent < 15) {
    return { level: 'medium', label: '中等影响', color: '#ffb300' };
  } else if (lossPercent < 30) {
    return { level: 'high', label: '显著影响', color: '#fb8c00' };
  } else {
    return { level: 'critical', label: '严重影响', color: '#e53935' };
  }
}

export function suggestShadingMitigation(periods: ShadingPeriod[]): string[] {
  const suggestions: string[] = [];
  const validation = validateShadingPeriods(periods);

  if (validation.spansNoon) {
    suggestions.push(
      '正午时段遮挡影响最大，建议修剪或移除正午方向的遮挡物'
    );
  }

  if (periods.length > 2) {
    suggestions.push('遮挡时段较多，建议考虑调整安装位置减少遮挡');
  }

  const morningShading = periods.some(
    (p) => p.startHour >= 6 && p.endHour <= 10
  );
  const afternoonShading = periods.some(
    (p) => p.startHour >= 14 && p.endHour <= 18
  );

  if (morningShading && !afternoonShading) {
    suggestions.push(
      '主要为上午遮挡，可考虑将组件朝西偏转5-10°补偿下午发电量'
    );
  } else if (afternoonShading && !morningShading) {
    suggestions.push(
      '主要为下午遮挡，可考虑将组件朝东偏转5-10°补偿上午发电量'
    );
  }

  if (suggestions.length === 0) {
    suggestions.push('遮挡影响可控，当前方案可接受');
  }

  return suggestions;
}
