const fs = require('fs');
const yaml = require('yaml');

const CheckpointType = {
  START: 'start',
  END: 'end',
  CORNER: 'corner',
  STRAIGHT: 'straight',
  OBSTACLE: 'obstacle',
  CROSSING: 'crossing',
  CUSTOM: 'custom'
};

class YAMLParser {
  constructor(options = {}) {
    this.strictMode = options.strictMode !== false;
    this.encoding = options.encoding || 'utf-8';
  }

  async parseFile(filePath) {
    const content = await fs.promises.readFile(filePath, this.encoding);
    return this.parseString(content);
  }

  parseString(content) {
    const errors = [];
    const warnings = [];

    try {
      const data = yaml.parse(content);
      
      if (!data) {
        return {
          data: null,
          errors: ['Empty or invalid YAML content'],
          warnings: [],
          stats: { checkpoints: 0, obstacles: 0 }
        };
      }

      const validation = this._validateData(data);
      
      if (!validation.valid && this.strictMode) {
        return {
          data: null,
          errors: validation.errors,
          warnings: validation.warnings,
          stats: { checkpoints: 0, obstacles: 0 }
        };
      }

      validation.warnings.forEach(w => warnings.push(w));

      const parsedData = this._normalizeData(data);

      return {
        data: parsedData,
        errors: validation.valid ? [] : validation.errors,
        warnings,
        stats: {
          checkpoints: parsedData.checkpoints?.length || 0,
          obstacles: parsedData.obstacles?.length || 0
        }
      };
    } catch (e) {
      return {
        data: null,
        errors: [`YAML parse error: ${e.message}`],
        warnings: [],
        stats: { checkpoints: 0, obstacles: 0 }
      };
    }
  }

  _validateData(data) {
    const errors = [];
    const warnings = [];

    if (!data.track_name) {
      warnings.push('Missing track_name field');
    }

    if (data.track_length !== undefined && typeof data.track_length !== 'number') {
      errors.push('track_length must be a number');
    }

    if (data.checkpoints) {
      if (!Array.isArray(data.checkpoints)) {
        errors.push('checkpoints must be an array');
      } else {
        data.checkpoints.forEach((cp, idx) => {
          if (!cp.id && cp.id !== 0) {
            warnings.push(`Checkpoint ${idx} missing id field`);
          }
          if (!cp.position) {
            errors.push(`Checkpoint ${idx} missing position field`);
          } else {
            if (typeof cp.position.x !== 'number') {
              errors.push(`Checkpoint ${idx} position.x must be a number`);
            }
            if (typeof cp.position.y !== 'number') {
              errors.push(`Checkpoint ${idx} position.y must be a number`);
            }
          }
          if (cp.type && !Object.values(CheckpointType).includes(cp.type)) {
            warnings.push(`Checkpoint ${idx} has unknown type: ${cp.type}`);
          }
        });
      }
    }

    if (data.obstacles) {
      if (!Array.isArray(data.obstacles)) {
        errors.push('obstacles must be an array');
      } else {
        data.obstacles.forEach((obs, idx) => {
          if (!obs.position && !obs.bounds) {
            warnings.push(`Obstacle ${idx} missing position or bounds`);
          }
        });
      }
    }

    if (data.boundaries) {
      if (!Array.isArray(data.boundaries)) {
        errors.push('boundaries must be an array');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  _normalizeData(data) {
    return {
      track_name: data.track_name || 'Unknown Track',
      track_length: data.track_length || 0,
      track_width: data.track_width || null,
      checkpoints: this._normalizeCheckpoints(data.checkpoints || []),
      obstacles: this._normalizeObstacles(data.obstacles || []),
      boundaries: data.boundaries || [],
      metadata: data.metadata || {},
      raw_data: data
    };
  }

  _normalizeCheckpoints(checkpoints) {
    return checkpoints.map((cp, idx) => ({
      id: cp.id !== undefined ? cp.id : idx,
      position: {
        x: cp.position?.x || 0,
        y: cp.position?.y || 0,
        z: cp.position?.z || 0
      },
      type: cp.type || CheckpointType.CUSTOM,
      radius: cp.radius || 0.5,
      description: cp.description || '',
      tolerance: cp.tolerance || null,
      required: cp.required !== false
    }));
  }

  _normalizeObstacles(obstacles) {
    return obstacles.map((obs, idx) => ({
      id: obs.id !== undefined ? obs.id : idx,
      position: obs.position ? {
        x: obs.position.x || 0,
        y: obs.position.y || 0,
        z: obs.position.z || 0
      } : null,
      bounds: obs.bounds || null,
      type: obs.type || 'unknown',
      size: obs.size || { width: 0, height: 0, depth: 0 },
      description: obs.description || ''
    }));
  }

  async validateFile(filePath) {
    const result = await this.parseFile(filePath);
    return {
      isValid: result.errors.length === 0,
      errors: result.errors,
      warnings: result.warnings,
      stats: result.stats
    };
  }

  getCheckpointsByType(checkpoints, type) {
    return checkpoints.filter(cp => cp.type === type);
  }

  getCheckpointsInRange(checkpoints, position, radius) {
    return checkpoints.filter(cp => {
      const dx = cp.position.x - position.x;
      const dy = cp.position.y - position.y;
      return Math.sqrt(dx * dx + dy * dy) <= radius;
    });
  }
}

module.exports = {
  YAMLParser,
  CheckpointType
};
