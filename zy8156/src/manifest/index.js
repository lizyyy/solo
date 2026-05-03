export class ManifestGenerator {
  constructor(baseDir) {
    this.baseDir = baseDir;
  }

  generate(configData, validationResult) {
    const {
      releasePolicy,
      cameraProfiles,
      sensorModes,
      calibrationFiles
    } = configData;

    const manifest = {
      version: '1.0.0',
      generated_at: new Date().toISOString(),
      release_policy: this.extractReleasePolicyInfo(releasePolicy),
      camera_profiles: this.extractCameraProfilesInfo(cameraProfiles),
      sensor_modes: this.extractSensorModesInfo(sensorModes),
      calibration_files: this.extractCalibrationFilesInfo(calibrationFiles),
      validation_summary: {
        valid: validationResult.valid,
        total_errors: validationResult.totalErrors,
        total_warnings: validationResult.totalWarnings,
        validation_details: this.generateValidationDetails(validationResult)
      },
      package_health: this.calculatePackageHealth(validationResult)
    };

    return manifest;
  }

  extractReleasePolicyInfo(releasePolicy) {
    return {
      version: releasePolicy.version || 'unknown',
      release_date: releasePolicy.release_date || null,
      models: releasePolicy.allowed_models || releasePolicy.models || [],
      target_platforms: releasePolicy.target_platforms || [],
      camera_profiles_path: releasePolicy.camera_profiles || 'camera_profiles.yaml',
      sensor_modes_path: releasePolicy.sensor_modes || 'sensor_modes.csv',
      calibration_dir: releasePolicy.calibration_dir || 'calibration'
    };
  }

  extractCameraProfilesInfo(cameraProfiles) {
    const profiles = [];

    if (Array.isArray(cameraProfiles)) {
      for (const profile of cameraProfiles) {
        profiles.push({
          model: profile.model || profile.name || 'unknown',
          sensor: profile.sensor || null,
          lens: profile.lens || null,
          isp_version: profile.isp_version || null,
          is_front_camera: profile.is_front_camera || false
        });
      }
    } else if (typeof cameraProfiles === 'object') {
      for (const [key, profile] of Object.entries(cameraProfiles)) {
        profiles.push({
          model: profile.model || key,
          sensor: profile.sensor || null,
          lens: profile.lens || null,
          isp_version: profile.isp_version || null,
          is_front_camera: profile.is_front_camera || false
        });
      }
    }

    return {
      count: profiles.length,
      profiles
    };
  }

  extractSensorModesInfo(sensorModes) {
    const resolutions = new Set();
    const modes = [];

    for (const mode of sensorModes) {
      const width = parseInt(mode.width);
      const height = parseInt(mode.height);
      
      if (!Number.isNaN(width) && !Number.isNaN(height)) {
        resolutions.add(`${width}x${height}`);
      }

      modes.push({
        mode_id: mode.mode_id || mode.id || null,
        width: mode.width,
        height: mode.height,
        fps: mode.fps || mode.frame_rate || null,
        bit_depth: mode.bit_depth || null,
        binning: mode.binning || null
      });
    }

    return {
      count: modes.length,
      resolutions: Array.from(resolutions),
      modes
    };
  }

  extractCalibrationFilesInfo(calibrationFiles) {
    const files = [];
    const models = new Set();

    for (const calib of calibrationFiles) {
      const content = calib.content;
      const model = content.model || content.device_model || 
        content.camera_model || content.metadata?.model || 'unknown';
      
      models.add(model);

      const fileInfo = {
        file_name: calib.fileName,
        file_path: calib.filePath,
        model,
        resolution: this.extractResolution(content),
        has_exposure_curve: !!content.exposure_curve,
        has_gain_curve: !!content.gain_curve,
        has_white_balance_matrix: !!content.white_balance_matrix,
        has_lens_shading_table: !!(content.lens_shading_table || content.lsc_table),
        has_ccm: !!(content.ccm || content.color_correction_matrix)
      };

      if (content.exposure_curve) {
        fileInfo.exposure_curve_length = content.exposure_curve.length;
      }
      if (content.gain_curve) {
        fileInfo.gain_curve_length = content.gain_curve.length;
      }

      files.push(fileInfo);
    }

    return {
      count: files.length,
      models: Array.from(models),
      files
    };
  }

  extractResolution(content) {
    if (content.resolution) {
      const { width, height } = content.resolution;
      if (width && height) return `${width}x${height}`;
    }
    if (content.sensor_mode) {
      const { width, height } = content.sensor_mode;
      if (width && height) return `${width}x${height}`;
    }
    if (content.width && content.height) {
      return `${content.width}x${content.height}`;
    }
    return null;
  }

  generateValidationDetails(validationResult) {
    const details = {};

    for (const [validatorName, result] of Object.entries(validationResult.byValidator)) {
      const errors = result.violations.filter(v => v.level === 'error');
      const warnings = result.violations.filter(v => v.level === 'warning');

      details[validatorName] = {
        valid: result.valid,
        error_count: errors.length,
        warning_count: warnings.length,
        errors: errors.map(v => ({
          category: v.category,
          message: v.message,
          context: v.context
        })),
        warnings: warnings.map(v => ({
          category: v.category,
          message: v.message,
          context: v.context
        }))
      };
    }

    return details;
  }

  calculatePackageHealth(validationResult) {
    if (validationResult.totalErrors > 0) {
      return {
        status: 'UNHEALTHY',
        score: 0,
        reason: `Found ${validationResult.totalErrors} error(s) that must be fixed before release`
      };
    }

    if (validationResult.totalWarnings > 0) {
      const warningThreshold = 5;
      const score = Math.max(50, 100 - (validationResult.totalWarnings * 5));
      
      return {
        status: 'CAUTION',
        score,
        reason: `Found ${validationResult.totalWarnings} warning(s) that should be reviewed`
      };
    }

    return {
      status: 'HEALTHY',
      score: 100,
      reason: 'All validation checks passed successfully'
    };
  }
}
