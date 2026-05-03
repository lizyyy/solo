import { BaseValidator } from './base.js';

export class ResolutionValidator extends BaseValidator {
  constructor() {
    super('resolution');
  }

  validate(calibrationFiles, sensorModes) {
    this.reset();

    const requiredResolutions = this.extractRequiredResolutions(sensorModes);
    const coveredResolutions = this.extractCoveredResolutions(calibrationFiles);

    const missingResolutions = requiredResolutions.filter(
      r => !coveredResolutions.has(r)
    );

    if (missingResolutions.length > 0) {
      this.addViolation(
        'error',
        'missing_resolution_modes',
        `Missing calibration for resolution modes: ${missingResolutions.join(', ')}`,
        {
          missingResolutions,
          requiredResolutions,
          coveredResolutions: Array.from(coveredResolutions)
        }
      );
    }

    this.validateModeSpecificCalibrations(calibrationFiles, sensorModes);
    this.validateNumericBounds(calibrationFiles);

    return {
      valid: this.isValid(),
      violations: this.getViolations()
    };
  }

  extractRequiredResolutions(sensorModes) {
    const resolutions = [];

    for (const mode of sensorModes) {
      const width = parseInt(mode.width);
      const height = parseInt(mode.height);

      if (!Number.isNaN(width) && !Number.isNaN(height)) {
        resolutions.push(`${width}x${height}`);
      }
    }

    return [...new Set(resolutions)];
  }

  extractCoveredResolutions(calibrationFiles) {
    const resolutions = new Set();

    for (const calib of calibrationFiles) {
      const content = calib.content;

      if (content.resolution) {
        const { width, height } = content.resolution;
        if (width && height) {
          resolutions.add(`${width}x${height}`);
        }
      }

      if (content.sensor_mode) {
        const mode = content.sensor_mode;
        if (mode.width && mode.height) {
          resolutions.add(`${mode.width}x${mode.height}`);
        }
      }

      if (content.width && content.height) {
        resolutions.add(`${content.width}x${content.height}`);
      }

      const nameMatch = calib.fileName.match(/_(\d+)x(\d+)_/);
      if (nameMatch) {
        resolutions.add(`${nameMatch[1]}x${nameMatch[2]}`);
      }
    }

    return resolutions;
  }

  validateModeSpecificCalibrations(calibrationFiles, sensorModes) {
    const modeMap = new Map();

    for (const mode of sensorModes) {
      const modeId = mode.mode_id || mode.id;
      if (modeId) {
        modeMap.set(String(modeId), mode);
      }
    }

    for (const calib of calibrationFiles) {
      const fileName = calib.fileName;
      const content = calib.content;

      const calibModeId = content.mode_id || content.sensor_mode_id;
      
      if (calibModeId && modeMap.size > 0) {
        if (!modeMap.has(String(calibModeId))) {
          this.addViolation(
            'warning',
            'unknown_mode_id',
            `Calibration file ${fileName} references unknown mode_id: ${calibModeId}`,
            { fileName, modeId: calibModeId }
          );
        }
      }
    }
  }

  validateNumericBounds(calibrationFiles) {
    for (const calib of calibrationFiles) {
      const fileName = calib.fileName;
      const content = calib.content;

      this.validateExposureBounds(content, fileName);
      this.validateGainBounds(content, fileName);
      this.validateGeneralNumericValues(content, fileName);
    }
  }

  validateExposureBounds(content, fileName) {
    if (content.exposure_time) {
      const exp = content.exposure_time;
      if (typeof exp === 'number') {
        if (exp < 0) {
          this.addViolation(
            'error',
            'exposure_negative',
            `Exposure time is negative: ${exp}`,
            { fileName, value: exp }
          );
        }
      }
    }

    if (Array.isArray(content.exposure_curve)) {
      for (let i = 0; i < content.exposure_curve.length; i++) {
        const point = content.exposure_curve[i];
        const time = point.exposure_time;
        
        if (typeof time === 'number') {
          if (time < 0) {
            this.addViolation(
              'error',
              'exposure_curve_negative',
              `Exposure curve point ${i} has negative exposure time: ${time}`,
              { fileName, index: i, value: time }
            );
          }
        }
      }
    }
  }

  validateGainBounds(content, fileName) {
    if (content.analog_gain) {
      const gain = content.analog_gain;
      if (typeof gain === 'number') {
        if (gain < 1) {
          this.addViolation(
            'warning',
            'gain_less_than_one',
            `Analog gain is less than 1: ${gain}`,
            { fileName, value: gain }
          );
        } else if (gain > 256) {
          this.addViolation(
            'warning',
            'gain_too_high',
            `Analog gain is unusually high: ${gain}`,
            { fileName, value: gain }
          );
        }
      }
    }

    if (Array.isArray(content.gain_curve)) {
      for (let i = 0; i < content.gain_curve.length; i++) {
        const point = content.gain_curve[i];
        const gain = point.analog_gain;
        
        if (typeof gain === 'number') {
          if (gain < 1) {
            this.addViolation(
              'warning',
              'gain_curve_less_than_one',
              `Gain curve point ${i} has gain less than 1: ${gain}`,
              { fileName, index: i, value: gain }
            );
          } else if (gain > 256) {
            this.addViolation(
              'warning',
              'gain_curve_too_high',
              `Gain curve point ${i} has unusually high gain: ${gain}`,
              { fileName, index: i, value: gain }
            );
          }
        }
      }
    }
  }

  validateGeneralNumericValues(content, fileName, prefix = '') {
    if (!content || typeof content !== 'object') return;

    for (const [key, value] of Object.entries(content)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'number') {
        if (Number.isNaN(value)) {
          this.addViolation(
            'error',
            'value_nan',
            `Value at ${fullKey} is NaN`,
            { fileName, key: fullKey }
          );
        } else if (!Number.isFinite(value)) {
          this.addViolation(
            'error',
            'value_infinite',
            `Value at ${fullKey} is infinite`,
            { fileName, key: fullKey }
          );
        }
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          this.validateGeneralNumericValues(
            value[i],
            fileName,
            `${fullKey}[${i}]`
          );
        }
      } else if (typeof value === 'object' && value !== null) {
        this.validateGeneralNumericValues(value, fileName, fullKey);
      }
    }
  }
}
