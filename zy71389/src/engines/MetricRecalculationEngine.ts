import { ExposureLog, ConversionData, Metrics } from '../types';

export class MetricRecalculationEngine {
  static calculateMetrics(
    exposures: ExposureLog[],
    conversions: ConversionData[],
    excludeContaminated: boolean = true
  ): Metrics {
    const filteredExposures = excludeContaminated
      ? exposures.filter(e => !e.isContaminated)
      : exposures;

    const exposureIds = new Set(filteredExposures.map(e => e.exposureId));
    const filteredConversions = conversions.filter(c => 
      exposureIds.has(c.exposureId)
    );

    const uniqueUsers = new Set(filteredExposures.map(e => e.userId));

    const totalConversions = filteredConversions.length;
    const totalValue = filteredConversions.reduce((sum, c) => sum + c.conversionValue, 0);
    const conversionRate = filteredExposures.length > 0 
      ? totalConversions / filteredExposures.length 
      : 0;
    const averageValue = totalConversions > 0 
      ? totalValue / totalConversions 
      : 0;

    return {
      conversionRate,
      averageValue,
      totalConversions,
      totalValue,
      uniqueUsers: uniqueUsers.size
    };
  }

  static calculateOriginalMetrics(
    exposures: ExposureLog[],
    conversions: ConversionData[]
  ): Metrics {
    return this.calculateMetrics(exposures, conversions, false);
  }

  static calculateRecalculatedMetrics(
    exposures: ExposureLog[],
    conversions: ConversionData[]
  ): Metrics {
    return this.calculateMetrics(exposures, conversions, true);
  }

  static calculateGroupMetrics(
    groupId: string,
    exposures: ExposureLog[],
    conversions: ConversionData[],
    excludeContaminated: boolean = true
  ): Metrics {
    const groupExposures = exposures.filter(e => e.groupId === groupId);
    return this.calculateMetrics(groupExposures, conversions, excludeContaminated);
  }

  static calculateTimeSeriesMetrics(
    exposures: ExposureLog[],
    conversions: ConversionData[],
    intervalMinutes: number = 60,
    excludeContaminated: boolean = true
  ): Array<{
    timestamp: number;
    metrics: Metrics;
    exposureCount: number;
    contaminationCount: number;
  }> {
    if (exposures.length === 0) return [];

    const sortedExposures = [...exposures].sort((a, b) => a.exposureTime - b.exposureTime);
    const startTime = sortedExposures[0].exposureTime;
    const endTime = sortedExposures[sortedExposures.length - 1].exposureTime;
    const intervalMs = intervalMinutes * 60 * 1000;

    const result: Array<{
      timestamp: number;
      metrics: Metrics;
      exposureCount: number;
      contaminationCount: number;
    }> = [];

    let currentTime = startTime;
    while (currentTime <= endTime) {
      const intervalStart = currentTime;
      const intervalEnd = currentTime + intervalMs;

      const intervalExposures = exposures.filter(e => 
        e.exposureTime >= intervalStart && 
        e.exposureTime < intervalEnd
      );

      const filteredExposures = excludeContaminated
        ? intervalExposures.filter(e => !e.isContaminated)
        : intervalExposures;

      const metrics = this.calculateMetrics(filteredExposures, conversions, false);

      result.push({
        timestamp: intervalStart,
        metrics,
        exposureCount: intervalExposures.length,
        contaminationCount: intervalExposures.filter(e => e.isContaminated).length
      });

      currentTime += intervalMs;
    }

    return result;
  }

  static calculateMetricsComparison(
    originalMetrics: Metrics,
    recalculatedMetrics: Metrics
  ): {
    conversionRateDiff: number;
    conversionRateDiffPercent: number;
    averageValueDiff: number;
    averageValueDiffPercent: number;
    totalConversionsDiff: number;
    totalConversionsDiffPercent: number;
    excludedExposures: number;
  } {
    const conversionRateDiff = recalculatedMetrics.conversionRate - originalMetrics.conversionRate;
    const conversionRateDiffPercent = originalMetrics.conversionRate > 0 
      ? (conversionRateDiff / originalMetrics.conversionRate) * 100 
      : 0;

    const averageValueDiff = recalculatedMetrics.averageValue - originalMetrics.averageValue;
    const averageValueDiffPercent = originalMetrics.averageValue > 0 
      ? (averageValueDiff / originalMetrics.averageValue) * 100 
      : 0;

    const totalConversionsDiff = recalculatedMetrics.totalConversions - originalMetrics.totalConversions;
    const totalConversionsDiffPercent = originalMetrics.totalConversions > 0 
      ? (totalConversionsDiff / originalMetrics.totalConversions) * 100 
      : 0;

    const excludedExposures = originalMetrics.uniqueUsers - recalculatedMetrics.uniqueUsers;

    return {
      conversionRateDiff,
      conversionRateDiffPercent,
      averageValueDiff,
      averageValueDiffPercent,
      totalConversionsDiff,
      totalConversionsDiffPercent,
      excludedExposures
    };
  }

  static formatRate(rate: number, decimals: number = 2): string {
    return `${(rate * 100).toFixed(decimals)}%`;
  }

  static formatValue(value: number, decimals: number = 2): string {
    return value.toFixed(decimals);
  }

  static formatNumber(num: number): string {
    return num.toLocaleString('zh-CN');
  }
}
