import { BaseValidator } from './base.js';

export class ExposureGainValidator extends BaseValidator {
  constructor() {
    super('exposure_gain');
  }

  validate(calibrationFiles) {
    this.reset();

    for (const calib of calibrationFiles) {
      const fileName = calib.fileName;
      const content = calib.content;

      if (content.exposure_curve) {
        this.validateMonotonicity(
          content.exposure_curve,
          fileName,
          'exposure',
          'exposure_time'
        );
      }

      if (content.gain_curve) {
        this.validateMonotonicity(
          content.gain_curve,
          fileName,
          'gain',
          'analog_gain'
        );
      }

      if (content.exposure_curve && content.gain_curve) {
        this.validateCurveConsistency(
          content.exposure_curve,
          content.gain_curve,
          fileName
        );
      }

      this.validateCurveValues(content.exposure_curve, fileName, 'exposure');
      this.validateCurveValues(content.gain_curve, fileName, 'gain');
    }

    return {
      valid: this.isValid(),
      violations: this.getViolations()
    };
  }

  validateMonotonicity(curve, fileName, curveType, valueKey) {
    if (!Array.isArray(curve) || curve.length === 0) {
      this.addViolation(
        'error',
        `${curveType}_curve_empty`,
        `${curveType} curve is empty or not an array`,
        { fileName, curveType }
      );
      return;
    }

    if (curve.length < 2) {
      this.addViolation(
        'warning',
        `${curveType}_curve_too_short`,
        `${curveType} curve has only ${curve.length} point(s), minimum 2 points recommended`,
        { fileName, curveType, pointCount: curve.length }
      );
      return;
    }

    let isIncreasing = true;
    let isDecreasing = true;

    for (let i = 1; i < curve.length; i++) {
      const prevValue = this.getNumericValue(curve[i - 1][valueKey]);
      const currValue = this.getNumericValue(curve[i][valueKey]);

      if (Number.isNaN(prevValue) || Number.isNaN(currValue)) {
        this.addViolation(
          'error',
          `${curveType}_curve_nan`,
          `NaN value found in ${curveType} curve at index ${i}`,
          { fileName, curveType, index: i, prevValue, currValue }
        );
        continue;
      }

      if (currValue < prevValue) {
        isIncreasing = false;
      }
      if (currValue > prevValue) {
        isDecreasing = false;
      }
    }

    if (!isIncreasing && !isDecreasing) {
      this.addViolation(
        'error',
        `${curveType}_curve_not_monotonic`,
        `${curveType} curve is not monotonic (neither strictly increasing nor decreasing)`,
        { fileName, curveType }
      );
    } else if (!isIncreasing) {
      this.addViolation(
        'warning',
        `${curveType}_curve_decreasing`,
        `${curveType} curve is decreasing - verify if this is intentional`,
        { fileName, curveType }
      );
    }
  }

  validateCurveConsistency(exposureCurve, gainCurve, fileName) {
    const expLength = exposureCurve.length;
    const gainLength = gainCurve.length;

    if (expLength !== gainLength) {
      this.addViolation(
        'warning',
        'curve_length_mismatch',
        `Exposure curve length (${expLength}) does not match gain curve length (${gainLength})`,
        { fileName, exposureLength: expLength, gainLength }
      );
    }
  }

  validateCurveValues(curve, fileName, curveType) {
    if (!Array.isArray(curve)) return;

    for (let i = 0; i < curve.length; i++) {
      const point = curve[i];
      
      for (const [key, value] of Object.entries(point)) {
        if (typeof value === 'number') {
          if (Number.isNaN(value)) {
            this.addViolation(
              'error',
              `${curveType}_value_nan`,
              `NaN value found in ${curveType} curve at index ${i}, key: ${key}`,
              { fileName, curveType, index: i, key }
            );
          } else if (!Number.isFinite(value)) {
            this.addViolation(
              'error',
              `${curveType}_value_infinite`,
              `Infinite value found in ${curveType} curve at index ${i}, key: ${key}`,
              { fileName, curveType, index: i, key }
            );
          }
        }
      }
    }
  }

  getNumericValue(value) {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return Number.isNaN(parsed) ? NaN : parsed;
    }
    return NaN;
  }
}
