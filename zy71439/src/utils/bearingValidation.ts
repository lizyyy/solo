import { BearingData, DMS } from '../types';
import { validateDMS } from './bearingConversion';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateAllBearings(bearings: BearingData[]): { hasErrors: boolean; errors: string[] } {
  const errors: string[] = [];

  if (bearings.length < 3) {
    errors.push(`需要至少3个方位角数据，当前只有${bearings.length}个`);
  }

  bearings.forEach(bearing => {
    const lighthouseName = bearing.lighthouseId;
    const dms: DMS = {
      degrees: bearing.degrees,
      minutes: bearing.minutes,
      seconds: bearing.seconds
    };
    const validation = validateDMS(dms);
    if (!validation.valid && validation.error) {
      errors.push(`${lighthouseName}: ${validation.error}`);
    }

    if (bearing.hasUnitError) {
      errors.push(`${lighthouseName}: 存在角度单位错误，请确认输入值`);
    }
  });

  const bearingValues = bearings.map(b => b.decimalDegrees);
  for (let i = 0; i < bearingValues.length; i++) {
    for (let j = i + 1; j < bearingValues.length; j++) {
      const diff = Math.abs(bearingValues[i] - bearingValues[j]);
      if (diff < 10 || diff > 350) {
        errors.push(`方位角差异过小（${diff.toFixed(1)}°），可能影响定位精度`);
      }
    }
  }

  return {
    hasErrors: errors.length > 0,
    errors
  };
}

export function checkUnitError(
  inputValue: number,
  expectedBearing: number,
  tolerance: number = 5
): boolean {
  const diff = Math.abs(inputValue - expectedBearing);
  const diffWrapped = Math.min(diff, 360 - diff);

  if (diffWrapped > tolerance) {
    const timesTen = inputValue * 10;
    const diffTimesTen = Math.abs(timesTen - expectedBearing);
    const diffTimesTenWrapped = Math.min(diffTimesTen, 360 - diffTimesTen);
    if (diffTimesTenWrapped < tolerance) {
      return true;
    }

    const dividedByTen = inputValue / 10;
    const diffDivided = Math.abs(dividedByTen - expectedBearing);
    const diffDividedWrapped = Math.min(diffDivided, 360 - diffDivided);
    if (diffDividedWrapped < tolerance) {
      return true;
    }
  }

  return false;
}

export function validateBearingRange(degrees: number): boolean {
  return degrees >= 0 && degrees < 360;
}
