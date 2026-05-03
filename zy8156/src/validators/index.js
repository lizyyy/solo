export { BaseValidator } from './base.js';
export { ExposureGainValidator } from './exposureGainValidator.js';
export { WhiteBalanceValidator } from './whiteBalanceValidator.js';
export { LensShadingValidator } from './lensShadingValidator.js';
export { ModelValidator } from './modelValidator.js';
export { ResolutionValidator } from './resolutionValidator.js';

import { ExposureGainValidator } from './exposureGainValidator.js';
import { WhiteBalanceValidator } from './whiteBalanceValidator.js';
import { LensShadingValidator } from './lensShadingValidator.js';
import { ModelValidator } from './modelValidator.js';
import { ResolutionValidator } from './resolutionValidator.js';

export class ValidationManager {
  constructor() {
    this.validators = {
      exposureGain: new ExposureGainValidator(),
      whiteBalance: new WhiteBalanceValidator(),
      lensShading: new LensShadingValidator(),
      model: new ModelValidator(),
      resolution: new ResolutionValidator()
    };
  }

  validate(configData) {
    const {
      calibrationFiles,
      sensorModes,
      cameraProfiles,
      releasePolicy
    } = configData;

    const allViolations = [];
    const results = {};

    const expGainResult = this.validators.exposureGain.validate(calibrationFiles);
    allViolations.push(...expGainResult.violations);
    results.exposureGain = expGainResult;

    const wbResult = this.validators.whiteBalance.validate(calibrationFiles);
    allViolations.push(...wbResult.violations);
    results.whiteBalance = wbResult;

    const lsResult = this.validators.lensShading.validate(calibrationFiles, sensorModes);
    allViolations.push(...lsResult.violations);
    results.lensShading = lsResult;

    const modelResult = this.validators.model.validate(
      calibrationFiles,
      cameraProfiles,
      releasePolicy
    );
    allViolations.push(...modelResult.violations);
    results.model = modelResult;

    const resResult = this.validators.resolution.validate(calibrationFiles, sensorModes);
    allViolations.push(...resResult.violations);
    results.resolution = resResult;

    const errors = allViolations.filter(v => v.level === 'error');
    const warnings = allViolations.filter(v => v.level === 'warning');

    return {
      valid: errors.length === 0,
      totalErrors: errors.length,
      totalWarnings: warnings.length,
      violations: allViolations,
      errors,
      warnings,
      byValidator: results
    };
  }
}
