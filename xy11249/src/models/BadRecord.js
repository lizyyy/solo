const { v4: uuidv4 } = require('uuid');

class BadRecord {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.sourceType = data.sourceType;
    this.sourceFile = data.sourceFile;
    this.rowNumber = data.rowNumber;
    this.rawData = data.rawData;
    this.errorType = data.errorType;
    this.errorMessage = data.errorMessage;
    this.suggestion = data.suggestion || '';
    this.fieldName = data.fieldName || null;
    this.fieldValue = data.fieldValue || null;
    this.status = data.status || 'unresolved';
    this.resolvedBy = data.resolvedBy || null;
    this.resolvedAt = data.resolvedAt ? new Date(data.resolvedAt) : null;
    this.resolutionNote = data.resolutionNote || '';
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
  }

  toJSON() {
    return {
      id: this.id,
      sourceType: this.sourceType,
      sourceFile: this.sourceFile,
      rowNumber: this.rowNumber,
      rawData: this.rawData,
      errorType: this.errorType,
      errorMessage: this.errorMessage,
      suggestion: this.suggestion,
      fieldName: this.fieldName,
      fieldValue: this.fieldValue,
      status: this.status,
      resolvedBy: this.resolvedBy,
      resolvedAt: this.resolvedAt ? this.resolvedAt.toISOString() : null,
      resolutionNote: this.resolutionNote,
      createdAt: this.createdAt.toISOString(),
    };
  }

  static fromJSON(json) {
    return new BadRecord(json);
  }
}

module.exports = BadRecord;
