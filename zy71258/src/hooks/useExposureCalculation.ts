import { useMemo } from 'react';
import type { Artwork, Exhibition, SamplingData, CumulativeExposureResult } from '@/types';
import { LIGHT_RESISTANCE_THRESHOLDS } from '@/types';

function calculateExhibitionDays(exhibition: Exhibition): number {
  const start = new Date(exhibition.startDate);
  const end = new Date(exhibition.endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

function generateExpectedSamplingDays(exhibition: Exhibition): string[] {
  const days: string[] = [];
  const start = new Date(exhibition.startDate);
  const end = new Date(exhibition.endDate);
  
  const current = new Date(start);
  while (current <= end) {
    days.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return days;
}

function extractSamplingDays(samplingData: SamplingData[]): string[] {
  const days = new Set<string>();
  samplingData.forEach(data => {
    const day = data.measuredAt.split('T')[0];
    days.add(day);
  });
  return Array.from(days);
}

function integrateSamplingData(
  samplingData: SamplingData[],
  exhibition: Exhibition
): number {
  const dailyAverages: Record<string, number[]> = {};
  
  samplingData.forEach(data => {
    const day = data.measuredAt.split('T')[0];
    if (!dailyAverages[day]) {
      dailyAverages[day] = [];
    }
    dailyAverages[day].push(data.measuredValue);
  });
  
  let totalExposure = 0;
  Object.values(dailyAverages).forEach(dayValues => {
    const avg = dayValues.reduce((sum, v) => sum + v, 0) / dayValues.length;
    totalExposure += avg * exhibition.dailyOpenHours;
  });
  
  return totalExposure;
}

function arrayDifference<T>(a: T[], b: T[]): T[] {
  const setB = new Set(b);
  return a.filter(item => !setB.has(item));
}

export function calculateCumulativeExposure(
  artwork: Artwork,
  exhibition: Exhibition,
  averageIllumination: number,
  existingSamplingData?: SamplingData[]
): CumulativeExposureResult {
  const totalDays = calculateExhibitionDays(exhibition);
  const totalHours = totalDays * exhibition.dailyOpenHours;
  const calculatedExposure = averageIllumination * totalHours;
  
  let actualExposure = 0;
  let leakageDays: string[] = [];
  const exposureByDay: Array<{ date: string; exposure: number }> = [];
  
  if (existingSamplingData && existingSamplingData.length > 0) {
    actualExposure = integrateSamplingData(existingSamplingData, exhibition);
    
    const expectedDays = generateExpectedSamplingDays(exhibition);
    const actualDays = extractSamplingDays(existingSamplingData);
    leakageDays = arrayDifference(expectedDays, actualDays);
    
    const dailyData: Record<string, number[]> = {};
    existingSamplingData.forEach(data => {
      const day = data.measuredAt.split('T')[0];
      if (!dailyData[day]) {
        dailyData[day] = [];
      }
      dailyData[day].push(data.measuredValue);
    });
    
    Object.entries(dailyData).forEach(([date, values]) => {
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
      exposureByDay.push({
        date,
        exposure: avg * exhibition.dailyOpenHours
      });
    });
  } else {
    actualExposure = calculatedExposure;
    
    const expectedDays = generateExpectedSamplingDays(exhibition);
    expectedDays.forEach(date => {
      exposureByDay.push({
        date,
        exposure: averageIllumination * exhibition.dailyOpenHours
      });
    });
  }
  
  return {
    totalExposure: Math.max(calculatedExposure, actualExposure),
    calculatedExposure,
    actualExposure,
    leakageDays,
    exposureByDay
  };
}

export function getExposureRiskLevel(
  totalExposure: number,
  exhibition: Exhibition
): { riskLevel: 'low' | 'medium' | 'high' | 'critical'; remainingExposure: number; daysRemaining: number } {
  const now = new Date();
  const endDate = new Date(exhibition.endDate);
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  
  const totalExhibitionDays = calculateExhibitionDays(exhibition);
  const elapsedDays = totalExhibitionDays - daysRemaining;
  const expectedExposureRate = totalExposure / Math.max(1, elapsedDays);
  const remainingExposure = expectedExposureRate * daysRemaining;
  
  const maxAnnualExposure = 50000;
  const annualizedExposure = totalExposure * (365 / Math.max(1, totalExhibitionDays));
  
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (annualizedExposure < maxAnnualExposure * 0.5) {
    riskLevel = 'low';
  } else if (annualizedExposure < maxAnnualExposure * 0.8) {
    riskLevel = 'medium';
  } else if (annualizedExposure < maxAnnualExposure) {
    riskLevel = 'high';
  } else {
    riskLevel = 'critical';
  }
  
  return {
    riskLevel,
    remainingExposure,
    daysRemaining
  };
}

export function useExposureCalculation(
  artwork: Artwork | null,
  exhibition: Exhibition | null,
  samplingData: SamplingData[],
  currentIllumination: number
) {
  const exposureResult = useMemo(() => {
    if (!artwork || !exhibition) return null;
    
    const artworkSamplingData = samplingData.filter(d => {
      const pointId = d.samplingPointId;
      return pointId.startsWith('sp-');
    });
    
    return calculateCumulativeExposure(
      artwork,
      exhibition,
      currentIllumination,
      artworkSamplingData.length > 0 ? artworkSamplingData : undefined
    );
  }, [artwork, exhibition, samplingData, currentIllumination]);
  
  const exposureRisk = useMemo(() => {
    if (!exposureResult || !exhibition) return null;
    return getExposureRiskLevel(exposureResult.totalExposure, exhibition);
  }, [exposureResult, exhibition]);
  
  const threshold = useMemo(() => {
    if (!artwork) return null;
    return LIGHT_RESISTANCE_THRESHOLDS[artwork.lightResistanceGrade];
  }, [artwork]);
  
  const isExceedingThreshold = useMemo(() => {
    if (!exposureResult || !threshold) return false;
    return exposureResult.totalExposure > threshold.maxAnnualExposure * 0.1;
  }, [exposureResult, threshold]);
  
  return {
    exposureResult,
    exposureRisk,
    threshold,
    isExceedingThreshold
  };
}
