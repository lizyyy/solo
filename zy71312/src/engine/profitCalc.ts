import type { SeasonWeights } from '../types';
import { getMonthlyGenerationFactors } from './solarMath';
import { calculateAngleEfficiency } from './angleOptimize';

export function calculateAnnualEnergy(params: {
  latitude: number;
  tiltAngle: number;
  panelPower: number;
  panelCount: number;
  shadingLoss: number;
  seasonWeights: SeasonWeights;
}): {
  annualEnergy: number;
  monthlyEnergy: number[];
  hourlyEnergy: number[];
} {
  const { latitude, tiltAngle, panelPower, panelCount, shadingLoss, seasonWeights } = params;

  const systemCapacity = (panelPower * panelCount) / 1000;

  const angleEfficiency = calculateAngleEfficiency(latitude, tiltAngle);

  const monthlyFactors = getMonthlyGenerationFactors(latitude);

  const seasonMonthWeights = {
    spring: seasonWeights.spring / 3,
    summer: seasonWeights.summer / 3,
    autumn: seasonWeights.autumn / 3,
    winter: seasonWeights.winter / 3,
  };

  const monthSeasonWeights = [
    seasonMonthWeights.winter,
    seasonMonthWeights.winter,
    seasonMonthWeights.spring,
    seasonMonthWeights.spring,
    seasonMonthWeights.spring,
    seasonMonthWeights.summer,
    seasonMonthWeights.summer,
    seasonMonthWeights.summer,
    seasonMonthWeights.autumn,
    seasonMonthWeights.autumn,
    seasonMonthWeights.autumn,
    seasonMonthWeights.winter,
  ];

  const totalSeasonWeight =
    seasonWeights.spring +
    seasonWeights.summer +
    seasonWeights.autumn +
    seasonWeights.winter;

  const normalizationFactor = totalSeasonWeight > 0 ? 4 / totalSeasonWeight : 1;

  const peakSunHoursBase = 3.5 + 0.03 * (35 - Math.abs(latitude - 35));
  const monthlyEnergy: number[] = [];
  const hourlyEnergy: number[] = new Array(24).fill(0);

  monthlyFactors.forEach((factor, index) => {
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][index];
    const seasonWeight = monthSeasonWeights[index] * normalizationFactor;
    const monthlyOutput =
      systemCapacity *
      peakSunHoursBase *
      factor *
      angleEfficiency *
      daysInMonth *
      seasonWeight *
      (1 - shadingLoss / 100) *
      0.8;
    monthlyEnergy.push(Math.round(monthlyOutput));

    for (let h = 0; h < 24; h++) {
      const hourFactor = Math.max(
        0,
        Math.sin(((h - 6) / 12) * Math.PI)
      );
      hourlyEnergy[h] += (monthlyOutput / daysInMonth / 12) * hourFactor;
    }
  });

  const annualEnergy = Math.round(monthlyEnergy.reduce((a, b) => a + b, 0));

  for (let h = 0; h < 24; h++) {
    hourlyEnergy[h] = Math.round(hourlyEnergy[h] / 12);
  }

  return {
    annualEnergy,
    monthlyEnergy,
    hourlyEnergy,
  };
}

export function calculateProfit(params: {
  annualEnergy: number;
  electricityPrice: number;
  systemCost: number;
}): {
  annualProfit: number;
  paybackYears: number;
  profitYear25: number;
} {
  const { annualEnergy, electricityPrice, systemCost } = params;

  const annualProfit = Math.round(annualEnergy * electricityPrice * 0.9);
  const paybackYears =
    annualProfit > 0
      ? Math.round((systemCost / annualProfit) * 10) / 10
      : Infinity;
  const profitYear25 = Math.round(annualProfit * 25 - systemCost);

  return {
    annualProfit,
    paybackYears,
    profitYear25,
  };
}

export function calculateSystemCost(params: {
  panelPower: number;
  panelCount: number;
  panelPrice: number;
}): number {
  const { panelPower, panelCount, panelPrice } = params;

  const panelCost = panelPower * panelCount * panelPrice;
  const otherCost = panelCost * 0.7;

  return Math.round(panelCost + otherCost);
}

export function getEconomicSummary(params: {
  annualEnergy: number;
  electricityPrice: number;
  systemCost: number;
  annualProfit: number;
  paybackYears: number;
}): string {
  const { annualEnergy, electricityPrice, systemCost, annualProfit, paybackYears } =
    params;

  const roi = annualProfit / systemCost;
  let summary = `系统总投资${(systemCost / 10000).toFixed(2)}万元，年发电量${(annualEnergy / 1000).toFixed(1)}MWh，`;
  summary += `年收益约${annualProfit}元（电价${electricityPrice}元/kWh）。`;

  if (paybackYears <= 5) {
    summary += `投资回收期${paybackYears}年，回报优秀！`;
  } else if (paybackYears <= 8) {
    summary += `投资回收期${paybackYears}年，回报良好。`;
  } else if (paybackYears <= 10) {
    summary += `投资回收期${paybackYears}年，回报一般。`;
  } else {
    summary += `投资回收期${paybackYears}年，建议优化方案。`;
  }

  if (roi >= 0.15) {
    summary += ` 投资收益率${(roi * 100).toFixed(1)}%，具有较高投资价值。`;
  }

  return summary;
}
