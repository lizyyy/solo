import { useMemo } from 'react';
import type { SamplePoint, FitResult, FitMode } from '@/types';
import {
  generateTheoryCurve,
  calculateParameterImpact,
} from '@/utils/fitting/exponentialFit';
import { convertTimeToSeconds } from '@/utils/units';

export const useExponentialFit = (
  points: SamplePoint[],
  fitResult: FitResult | null,
  fitMode: FitMode,
  timeUnit: string
) => {
  const theoryCurve = useMemo(() => {
    if (!fitResult || points.length === 0) return [];

    const times = points.map((p) => convertTimeToSeconds(p.time, timeUnit as any));
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    return generateTheoryCurve(fitResult, fitMode, {
      min: minTime * 0.9,
      max: maxTime * 1.1,
    });
  }, [fitResult, points, fitMode, timeUnit]);

  const parameterImpacts = useMemo(() => {
    if (!fitResult || points.length === 0) return [];

    const voltages = points.map((p) => p.voltage);
    return calculateParameterImpact(fitResult, voltages);
  }, [fitResult, points]);

  const displayPoints = useMemo(() => {
    return points.map((p) => ({
      ...p,
      timeSeconds: convertTimeToSeconds(p.time, timeUnit as any),
    }));
  }, [points, timeUnit]);

  const statistics = useMemo(() => {
    if (!fitResult) return null;

    const voltages = points.map((p) => p.voltage);
    const minV = Math.min(...voltages);
    const maxV = Math.max(...voltages);

    return {
      minVoltage: minV,
      maxVoltage: maxV,
      voltageRange: maxV - minV,
      numPoints: points.length,
      numOutliers: points.filter((p) => p.isOutlier).length,
    };
  }, [fitResult, points]);

  return {
    theoryCurve,
    parameterImpacts,
    displayPoints,
    statistics,
  };
};
