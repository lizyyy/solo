const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const config = require('../config');

class Chemical {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.english_name = data.english_name;
    this.cas_number = data.cas_number;
    this.formula = data.formula;
    this.danger_level = data.danger_level;
    this.description = data.description;
    this.storage_requirements = data.storage_requirements;
    this.unit = data.unit;
    this.created_at = data.created_at || moment().toISOString();
    this.updated_at = data.updated_at || moment().toISOString();
    this.created_by = data.created_by;
    this.updated_by = data.updated_by;
  }

  static validate(data) {
    const errors = [];
    
    if (!data.name) {
      errors.push('试剂名称不能为空');
    }
    
    if (!data.danger_level) {
      errors.push('危险等级不能为空');
    }
    
    if (data.danger_level && !Object.values(config.danger_levels).includes(data.danger_level)) {
      errors.push(`危险等级必须是以下之一: ${Object.values(config.danger_levels).join(', ')}`);
    }
    
    if (!data.unit) {
      errors.push('计量单位不能为空');
    }
    
    return errors;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      english_name: this.english_name,
      cas_number: this.cas_number,
      formula: this.formula,
      danger_level: this.danger_level,
      description: this.description,
      storage_requirements: this.storage_requirements,
      unit: this.unit,
      created_at: this.created_at,
      updated_at: this.updated_at,
      created_by: this.created_by,
      updated_by: this.updated_by
    };
  }
}

module.exports = Chemical;
