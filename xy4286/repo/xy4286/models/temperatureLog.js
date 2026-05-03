const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class TemperatureLog {
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.boxId = options.boxId || null;
    this.timestamp = options.timestamp || moment().toISOString();
    this.temperature = options.temperature || 0;
    this.unit = options.unit || 'C';
    this.source = options.source || 'manual';
    this.notes = options.notes || '';
    this.createdAt = options.createdAt || moment().toISOString();
  }

  isOutOfRange(min, max) {
    return this.temperature < min || this.temperature > max;
  }

  toJSON() {
    return {
      id: this.id,
      boxId: this.boxId,
      timestamp: this.timestamp,
      temperature: this.temperature,
      unit: this.unit,
      source: this.source,
      notes: this.notes,
      createdAt: this.createdAt
    };
  }

  static fromJSON(json) {
    return new TemperatureLog(json);
  }
}

module.exports = TemperatureLog;
