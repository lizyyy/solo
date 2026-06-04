const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class SensorRecord {
  constructor(data) {
    this.id = uuidv4();
    this.sensorId = data.sensorId;
    this.siteStatement = data.siteStatement || '';
    this.installLocation = data.installLocation || '';
    this.calibrationDate = data.calibrationDate ? moment(data.calibrationDate) : null;
    this.operator = data.operator || '';
    this.verificationStatus = data.verificationStatus || 'pending';
    this.notes = data.notes || '';
    this.createdAt = moment().toISOString();
    this.updatedAt = moment().toISOString();
    this.linkedRecordIds = [];
  }

  linkToTemperatureRecord(recordId) {
    if (!this.linkedRecordIds.includes(recordId)) {
      this.linkedRecordIds.push(recordId);
      this.updatedAt = moment().toISOString();
    }
  }

  setVerificationStatus(status, operator, reason) {
    this.verificationStatus = status;
    this.updatedAt = moment().toISOString();
    if (!this.notes.includes(reason)) {
      this.notes += ` [${operator}: ${reason}]`;
    }
  }

  toJSON() {
    return {
      id: this.id,
      sensorId: this.sensorId,
      siteStatement: this.siteStatement,
      installLocation: this.installLocation,
      calibrationDate: this.calibrationDate ? this.calibrationDate.format() : null,
      operator: this.operator,
      verificationStatus: this.verificationStatus,
      notes: this.notes,
      linkedRecordIds: this.linkedRecordIds,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = SensorRecord;
