import { BaseValidator } from './base.js';

export class ModelValidator extends BaseValidator {
  constructor() {
    super('model_compatibility');
  }

  validate(calibrationFiles, cameraProfiles, releasePolicy) {
    this.reset();

    const allowedModels = this.extractAllowedModels(releasePolicy);
    const modelMap = new Map();

    for (const calib of calibrationFiles) {
      const fileName = calib.fileName;
      const content = calib.content;

      const model = this.extractModel(content, fileName);

      if (model) {
        if (!modelMap.has(model)) {
          modelMap.set(model, []);
        }
        modelMap.get(model).push({
          fileName,
          content
        });

        if (allowedModels.length > 0 && !allowedModels.includes(model)) {
          this.addViolation(
            'error',
            'model_not_allowed',
            `Model "${model}" in file ${fileName} is not in the allowed models list`,
            { fileName, model, allowedModels }
          );
        }
      } else {
        this.addViolation(
          'warning',
          'model_missing',
          `No model identifier found in calibration file: ${fileName}`,
          { fileName }
        );
      }
    }

    this.validateDuplicateModels(modelMap);
    this.validateCameraProfilesCoverage(modelMap, cameraProfiles);
    this.validateModelSpecificParameters(calibrationFiles);

    return {
      valid: this.isValid(),
      violations: this.getViolations()
    };
  }

  extractAllowedModels(releasePolicy) {
    const allowed = [];

    if (releasePolicy.allowed_models) {
      if (Array.isArray(releasePolicy.allowed_models)) {
        allowed.push(...releasePolicy.allowed_models);
      } else if (typeof releasePolicy.allowed_models === 'string') {
        allowed.push(releasePolicy.allowed_models);
      }
    }

    if (releasePolicy.models) {
      if (Array.isArray(releasePolicy.models)) {
        for (const model of releasePolicy.models) {
          if (typeof model === 'string') {
            allowed.push(model);
          } else if (model.name) {
            allowed.push(model.name);
          }
        }
      }
    }

    return [...new Set(allowed)];
  }

  extractModel(content, fileName) {
    if (content.model) return content.model;
    if (content.device_model) return content.device_model;
    if (content.camera_model) return content.camera_model;
    if (content.metadata?.model) return content.metadata.model;

    const nameMatch = fileName.match(/^([a-zA-Z0-9_]+)_/);
    if (nameMatch) {
      return nameMatch[1];
    }

    return null;
  }

  validateDuplicateModels(modelMap) {
    for (const [model, files] of modelMap.entries()) {
      if (files.length > 1) {
        const fileNames = files.map(f => f.fileName);
        
        const hasConflictingParams = this.checkParameterConflicts(files);
        
        if (hasConflictingParams) {
          this.addViolation(
            'error',
            'duplicate_model_conflict',
            `Model "${model}" has conflicting calibration parameters across files: ${fileNames.join(', ')}`,
            { model, files: fileNames, hasConflict: true }
          );
        } else {
          this.addViolation(
            'warning',
            'duplicate_model',
            `Model "${model}" appears in multiple calibration files: ${fileNames.join(', ')}`,
            { model, files: fileNames, hasConflict: false }
          );
        }
      }
    }
  }

  checkParameterConflicts(files) {
    if (files.length < 2) return false;

    const firstFile = files[0];
    
    for (let i = 1; i < files.length; i++) {
      const currentFile = files[i];
      
      if (this.haveConflictingCurves(firstFile.content, currentFile.content)) {
        return true;
      }
      
      if (this.haveConflictingMatrices(firstFile.content, currentFile.content)) {
        return true;
      }
    }

    return false;
  }

  haveConflictingCurves(content1, content2) {
    const curves1 = content1.exposure_curve || content1.gain_curve;
    const curves2 = content2.exposure_curve || content2.gain_curve;

    if (!curves1 || !curves2) return false;

    const length1 = Array.isArray(curves1) ? curves1.length : 0;
    const length2 = Array.isArray(curves2) ? curves2.length : 0;

    return length1 !== length2;
  }

  haveConflictingMatrices(content1, content2) {
    const wb1 = content1.white_balance_matrix;
    const wb2 = content2.white_balance_matrix;

    if (wb1 && wb2) {
      if (Array.isArray(wb1) && Array.isArray(wb2)) {
        if (wb1.length !== wb2.length) return true;
      }
    }

    return false;
  }

  validateCameraProfilesCoverage(modelMap, cameraProfiles) {
    const profileModels = this.extractProfileModels(cameraProfiles);

    if (profileModels.length === 0) return;

    for (const profileModel of profileModels) {
      if (!modelMap.has(profileModel)) {
        this.addViolation(
          'error',
          'missing_model_calibration',
          `Camera profile "${profileModel}" has no corresponding calibration file`,
          { profileModel, availableModels: Array.from(modelMap.keys()) }
        );
      }
    }
  }

  extractProfileModels(cameraProfiles) {
    const models = [];

    if (Array.isArray(cameraProfiles)) {
      for (const profile of cameraProfiles) {
        if (profile.model) {
          models.push(profile.model);
        }
      }
    } else if (typeof cameraProfiles === 'object') {
      for (const [key, profile] of Object.entries(cameraProfiles)) {
        if (profile.model) {
          models.push(profile.model);
        } else {
          models.push(key);
        }
      }
    }

    return models;
  }

  validateModelSpecificParameters(calibrationFiles) {
    for (const calib of calibrationFiles) {
      const fileName = calib.fileName;
      const content = calib.content;

      this.validateSensorSpecificValues(content, fileName);
      this.validateIspSpecificValues(content, fileName);
    }
  }

  validateSensorSpecificValues(content, fileName) {
    const sensorParams = content.sensor_parameters || content.sensor_info;
    
    if (!sensorParams) return;

    for (const [key, value] of Object.entries(sensorParams)) {
      if (typeof value === 'number') {
        if (Number.isNaN(value)) {
          this.addViolation(
            'error',
            'sensor_param_nan',
            `Sensor parameter ${key} is NaN`,
            { fileName, key }
          );
        } else if (!Number.isFinite(value)) {
          this.addViolation(
            'error',
            'sensor_param_infinite',
            `Sensor parameter ${key} is infinite`,
            { fileName, key }
          );
        }
      }
    }
  }

  validateIspSpecificValues(content, fileName) {
    const ispParams = content.isp_parameters || content.isp_settings;
    
    if (!ispParams) return;

    for (const [key, value] of Object.entries(ispParams)) {
      if (typeof value === 'number') {
        if (Number.isNaN(value)) {
          this.addViolation(
            'error',
            'isp_param_nan',
            `ISP parameter ${key} is NaN`,
            { fileName, key }
          );
        } else if (!Number.isFinite(value)) {
          this.addViolation(
            'error',
            'isp_param_infinite',
            `ISP parameter ${key} is infinite`,
            { fileName, key }
          );
        }
      }
    }
  }
}
