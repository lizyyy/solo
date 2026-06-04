const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class TemperatureCalibrationRecord {
  constructor(data, sourceLineNumber) {
    this.id = uuidv4();
    this.sourceLineNumber = sourceLineNumber;
    this.originalData = { ...data };
    this.manualChanges = [];
    this.sensorId = data.sensorId || null;
    this.calibrationTime = data.calibrationTime ? moment(data.calibrationTime) : null;
    this.temperature = data.temperature || null;
    this.humidity = data.humidity || null;
    this.processingStatus = 'pending';
    this.importBatchId = data.importBatchId || null;
    this.createdAt = moment().toISOString();
    this.updatedAt = moment().toISOString();
    this.notes = data.notes || '';
  }

  updateField(field, value, operator, reason) {
    const oldValue = this[field];
    let processedValue = value;
    
    if (field === 'calibrationTime' && value) {
      processedValue = moment(value);
    }
    
    this[field] = processedValue;
    this.manualChanges.push({
      field,
      oldValue: oldValue ? (oldValue.format ? oldValue.format() : oldValue) : null,
      newValue: processedValue ? (processedValue.format ? processedValue.format() : processedValue) : null,
      operator,
      reason,
      timestamp: moment().toISOString()
    });
    this.updatedAt = moment().toISOString();
  }

  setProcessingStatus(status) {
    this.processingStatus = status;
    this.updatedAt = moment().toISOString();
  }

  getAuditTrail() {
    return {
      id: this.id,
      sourceLineNumber: this.sourceLineNumber,
      originalData: this.originalData,
      manualChanges: this.manualChanges,
      processingStatus: this.processingStatus,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  hasMissingSampleTime() {
    if (!this.calibrationTime) return true;
    const expectedDuration = moment.duration(30, 'minutes');
    return false;
  }

  toJSON() {
    return {
      id: this.id,
      sourceLineNumber: this.sourceLineNumber,
      sensorId: this.sensorId,
      calibrationTime: this.calibrationTime ? this.calibrationTime.format() : null,
      temperature: this.temperature,
      humidity: this.humidity,
      processingStatus: this.processingStatus,
      importBatchId: this.importBatchId,
      notes: this.notes,
      hasMissingSampleTime: this.hasMissingSampleTime(),
      manualChanges: this.manualChanges,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = TemperatureCalibrationRecord;
