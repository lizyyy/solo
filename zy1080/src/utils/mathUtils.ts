export class MathUtils {
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  static round(value: number, decimals: number = 2): number {
    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
  }

  static average(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  static variance(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = this.average(values);
    const squaredDifferences = values.map(v => Math.pow(v - avg, 2));
    return this.average(squaredDifferences);
  }

  static standardDeviation(values: number[]): number {
    return Math.sqrt(this.variance(values));
  }

  static min(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.min(...values);
  }

  static max(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.max(...values);
  }

  static sum(values: number[]): number {
    return values.reduce((acc, val) => acc + val, 0);
  }

  static median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  static linearInterpolation(x: number, x0: number, y0: number, x1: number, y1: number): number {
    if (x0 === x1) return y0;
    return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
  }

  static calculateStabilityIndex(values: number[], optimalRange: { min: number; max: number }): number {
    if (values.length === 0) return 0;

    let inRangeCount = 0;
    let totalDeviation = 0;

    for (const value of values) {
      if (value >= optimalRange.min && value <= optimalRange.max) {
        inRangeCount++;
      } else {
        const deviation = value < optimalRange.min 
          ? optimalRange.min - value 
          : value - optimalRange.max;
        totalDeviation += deviation;
      }
    }

    const inRangeRatio = inRangeCount / values.length;
    const avgDeviation = values.length > inRangeCount 
      ? totalDeviation / (values.length - inRangeCount) 
      : 0;

    const rangeScore = inRangeRatio;
    const deviationScore = 1 - Math.min(1, avgDeviation / (optimalRange.max - optimalRange.min));

    return this.clamp((rangeScore + deviationScore) / 2, 0, 1);
  }

  static calculateRiskScore(
    currentValue: number,
    threshold: number,
    maxValue: number,
    isHigherRisk: boolean = true
  ): number {
    if (isHigherRisk) {
      if (currentValue <= threshold) return 0;
      const riskRange = maxValue - threshold;
      if (riskRange <= 0) return currentValue > threshold ? 1 : 0;
      return this.clamp((currentValue - threshold) / riskRange, 0, 1);
    } else {
      if (currentValue >= threshold) return 0;
      const riskRange = threshold;
      if (riskRange <= 0) return currentValue < threshold ? 1 : 0;
      return this.clamp((threshold - currentValue) / riskRange, 0, 1);
    }
  }

  static movingAverage(values: number[], windowSize: number): number[] {
    if (windowSize <= 0 || values.length === 0) return [];
    
    const result: number[] = [];
    const actualWindow = Math.min(windowSize, values.length);
    
    let windowSum = 0;
    for (let i = 0; i < actualWindow; i++) {
      windowSum += values[i];
    }
    result.push(windowSum / actualWindow);
    
    for (let i = actualWindow; i < values.length; i++) {
      windowSum = windowSum - values[i - actualWindow] + values[i];
      result.push(windowSum / actualWindow);
    }
    
    return result;
  }
}
