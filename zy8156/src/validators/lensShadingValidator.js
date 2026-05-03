import { BaseValidator } from './base.js';

export class LensShadingValidator extends BaseValidator {
  constructor() {
    super('lens_shading');
  }

  validate(calibrationFiles, sensorModes) {
    this.reset();

    const requiredResolutions = this.extractRequiredResolutions(sensorModes);

    for (const calib of calibrationFiles) {
      const fileName = calib.fileName;
      const content = calib.content;

      if (content.lens_shading_table) {
        this.validateLensShadingTable(
          content.lens_shading_table,
          fileName,
          requiredResolutions
        );
      }

      if (content.lsc_table || content.lens_shading_correction) {
        const lscTable = content.lsc_table || content.lens_shading_correction;
        this.validateLensShadingTable(
          lscTable,
          fileName,
          requiredResolutions
        );
      }

      this.validateShadingValues(content, fileName);
    }

    this.validateResolutionCoverage(
      calibrationFiles,
      requiredResolutions
    );

    return {
      valid: this.isValid(),
      violations: this.getViolations()
    };
  }

  extractRequiredResolutions(sensorModes) {
    const resolutions = new Set();

    for (const mode of sensorModes) {
      const width = parseInt(mode.width);
      const height = parseInt(mode.height);

      if (!Number.isNaN(width) && !Number.isNaN(height)) {
        resolutions.add(`${width}x${height}`);
      }
    }

    return Array.from(resolutions);
  }

  validateLensShadingTable(table, fileName, requiredResolutions) {
    if (!table) return;

    if (Array.isArray(table)) {
      for (let i = 0; i < table.length; i++) {
        const entry = table[i];
        this.validateShadingEntry(entry, fileName, i);
      }
    } else if (typeof table === 'object') {
      for (const [key, value] of Object.entries(table)) {
        this.validateShadingEntry(value, fileName, -1, key);
      }
    }
  }

  validateShadingEntry(entry, fileName, index, key = null) {
    const location = key ? `key: ${key}` : `index: ${index}`;

    if (!entry.width || !entry.height) {
      this.addViolation(
        'warning',
        'lens_shading_missing_resolution',
        `Lens shading entry at ${location} is missing width or height`,
        { fileName, location }
      );
    }

    if (entry.grid) {
      if (!Array.isArray(entry.grid)) {
        this.addViolation(
          'error',
          'lens_shading_grid_invalid',
          `Lens shading grid at ${location} is not an array`,
          { fileName, location }
        );
        return;
      }

      const rowCount = entry.grid.length;
      if (rowCount < 2) {
        this.addViolation(
          'warning',
          'lens_shading_grid_too_small',
          `Lens shading grid at ${location} has only ${rowCount} row(s), minimum 2 recommended`,
          { fileName, location, rowCount }
        );
      }

      for (let row = 0; row < entry.grid.length; row++) {
        const rowData = entry.grid[row];
        if (!Array.isArray(rowData)) {
          this.addViolation(
            'error',
            'lens_shading_grid_row_invalid',
            `Lens shading grid row ${row} at ${location} is not an array`,
            { fileName, location, row }
          );
          continue;
        }

        for (let col = 0; col < rowData.length; col++) {
          const value = rowData[col];
          this.validateShadingValue(
            value,
            fileName,
            location,
            row,
            col
          );
        }
      }
    }

    if (entry.channels) {
      const channels = ['r', 'gr', 'gb', 'b'];
      for (const channel of channels) {
        if (entry.channels[channel]) {
          this.validateChannelGrid(
            entry.channels[channel],
            fileName,
            location,
            channel
          );
        }
      }
    }
  }

  validateChannelGrid(channelData, fileName, location, channel) {
    if (!channelData.grid) return;

    if (!Array.isArray(channelData.grid)) {
      this.addViolation(
        'error',
        'lens_shading_channel_grid_invalid',
        `${channel} channel grid at ${location} is not an array`,
        { fileName, location, channel }
      );
      return;
    }

    for (let row = 0; row < channelData.grid.length; row++) {
      const rowData = channelData.grid[row];
      if (!Array.isArray(rowData)) {
        this.addViolation(
          'error',
          'lens_shading_channel_row_invalid',
          `${channel} channel grid row ${row} at ${location} is not an array`,
          { fileName, location, channel, row }
        );
        continue;
      }

      for (let col = 0; col < rowData.length; col++) {
        const value = rowData[col];
        this.validateShadingValue(
          value,
          fileName,
          `${location}, channel: ${channel}`,
          row,
          col
        );
      }
    }
  }

  validateShadingValue(value, fileName, location, row, col) {
    if (typeof value !== 'number') {
      this.addViolation(
        'error',
        'lens_shading_value_type',
        `Lens shading value at ${location}, [${row}][${col}] is not a number`,
        { fileName, location, row, col, type: typeof value }
      );
      return;
    }

    if (Number.isNaN(value)) {
      this.addViolation(
        'error',
        'lens_shading_value_nan',
        `Lens shading value at ${location}, [${row}][${col}] is NaN`,
        { fileName, location, row, col }
      );
    } else if (!Number.isFinite(value)) {
      this.addViolation(
        'error',
        'lens_shading_value_infinite',
        `Lens shading value at ${location}, [${row}][${col}] is infinite`,
        { fileName, location, row, col }
      );
    } else if (value < 0.5 || value > 2.0) {
      this.addViolation(
        'warning',
        'lens_shading_value_out_of_range',
        `Lens shading value at ${location}, [${row}][${col}] is outside typical range (0.5-2.0): ${value}`,
        { fileName, location, row, col, value }
      );
    }
  }

  validateShadingValues(content, fileName) {
    if (content.lens_shading_parameters) {
      const params = content.lens_shading_parameters;
      for (const [key, value] of Object.entries(params)) {
        if (typeof value === 'number') {
          if (Number.isNaN(value)) {
            this.addViolation(
              'error',
              'lens_shading_param_nan',
              `Lens shading parameter ${key} is NaN`,
              { fileName, key }
            );
          } else if (!Number.isFinite(value)) {
            this.addViolation(
              'error',
              'lens_shading_param_infinite',
              `Lens shading parameter ${key} is infinite`,
              { fileName, key }
            );
          }
        }
      }
    }
  }

  validateResolutionCoverage(calibrationFiles, requiredResolutions) {
    if (requiredResolutions.length === 0) return;

    const coveredResolutions = new Set();

    for (const calib of calibrationFiles) {
      const content = calib.content;
      const tables = [
        content.lens_shading_table,
        content.lsc_table,
        content.lens_shading_correction
      ].filter(Boolean);

      for (const table of tables) {
        if (Array.isArray(table)) {
          for (const entry of table) {
            if (entry.width && entry.height) {
              coveredResolutions.add(`${entry.width}x${entry.height}`);
            }
          }
        } else if (typeof table === 'object') {
          for (const [key, entry] of Object.entries(table)) {
            if (entry.width && entry.height) {
              coveredResolutions.add(`${entry.width}x${entry.height}`);
            }
          }
        }
      }
    }

    const missingResolutions = requiredResolutions.filter(
      r => !coveredResolutions.has(r)
    );

    if (missingResolutions.length > 0) {
      this.addViolation(
        'error',
        'lens_shading_resolution_coverage',
        `Lens shading tables missing coverage for resolutions: ${missingResolutions.join(', ')}`,
        { missingResolutions, coveredResolutions: Array.from(coveredResolutions), requiredResolutions }
      );
    }
  }
}
