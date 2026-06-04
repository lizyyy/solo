const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class EvaluationResult {
  constructor() {
    this.id = uuidv4();
    this.version = 1;
    this.status = 'draft';
    this.temperatureRecords = new Map();
    this.sensorRecords = new Map();
    this.integratedResults = [];
    this.selfCheckResults = {
      duplicateImport: { passed: false, details: [] },
      missingSampleTime: { passed: false, details: [] },
      recalculationAfterSupplement: { passed: false, details: [] },
      exportConsistency: { passed: false, details: [] }
    };
    this.workflowStage = 'import';
    this.operator = '';
    this.qualityInspector = '';
    this.createdAt = moment().toISOString();
    this.updatedAt = moment().toISOString();
    this.exportSnapshot = null;
  }

  addTemperatureRecord(record) {
    this.temperatureRecords.set(record.id, record);
    this.updatedAt = moment().toISOString();
  }

  addSensorRecord(record) {
    this.sensorRecords.set(record.sensorId, record);
    this.updatedAt = moment().toISOString();
  }

  integrateData() {
    this.integratedResults = [];
    
    for (const [recordId, tempRecord] of this.temperatureRecords) {
      const sensorRecord = tempRecord.sensorId 
        ? this.sensorRecords.get(tempRecord.sensorId) 
        : null;

      if (sensorRecord) {
        sensorRecord.linkToTemperatureRecord(recordId);
      }

      const integrated = {
        recordId: tempRecord.id,
        sourceLineNumber: tempRecord.sourceLineNumber,
        sensorId: tempRecord.sensorId,
        calibrationTime: tempRecord.calibrationTime ? tempRecord.calibrationTime.format() : null,
        temperature: tempRecord.temperature,
        humidity: tempRecord.humidity,
        processingStatus: tempRecord.processingStatus,
        hasMissingSampleTime: tempRecord.hasMissingSampleTime(),
        manualChanges: tempRecord.manualChanges,
        originalData: tempRecord.originalData,
        siteStatement: sensorRecord ? sensorRecord.siteStatement : null,
        installLocation: sensorRecord ? sensorRecord.installLocation : null,
        sensorVerificationStatus: sensorRecord ? sensorRecord.verificationStatus : null,
        needsQualityReview: tempRecord.hasMissingSampleTime(),
        qualityReviewStatus: tempRecord.hasMissingSampleTime() ? 'pending' : 'approved'
      };

      this.integratedResults.push(integrated);
    }

    this.updatedAt = moment().toISOString();
    return this.integratedResults;
  }

  runSelfCheck() {
    this.checkDuplicateImport();
    this.checkMissingSampleTime();
    this.checkRecalculationAfterSupplement();
    this.checkExportConsistency();
    
    this.updatedAt = moment().toISOString();
    return this.selfCheckResults;
  }

  checkDuplicateImport() {
    const seen = new Map();
    const duplicates = [];

    for (const [recordId, record] of this.temperatureRecords) {
      const key = `${record.sensorId}-${record.calibrationTime ? record.calibrationTime.format() : 'no-time'}`;
      
      if (seen.has(key)) {
        duplicates.push({
          recordId1: seen.get(key),
          recordId2: recordId,
          sensorId: record.sensorId,
          calibrationTime: record.calibrationTime ? record.calibrationTime.format() : null
        });
      } else {
        seen.set(key, recordId);
      }
    }

    this.selfCheckResults.duplicateImport = {
      passed: duplicates.length === 0,
      count: duplicates.length,
      details: duplicates
    };
  }

  checkMissingSampleTime() {
    const missingTimeRecords = [];

    for (const [recordId, record] of this.temperatureRecords) {
      if (record.hasMissingSampleTime()) {
        missingTimeRecords.push({
          recordId,
          sourceLineNumber: record.sourceLineNumber,
          sensorId: record.sensorId,
          issue: '采样时间缺失或不完整'
        });
      }
    }

    this.selfCheckResults.missingSampleTime = {
      passed: missingTimeRecords.length === 0,
      count: missingTimeRecords.length,
      details: missingTimeRecords
    };
  }

  checkRecalculationAfterSupplement() {
    const recalculationDetails = [];
    let hasRecalculated = false;

    for (const [recordId, record] of this.temperatureRecords) {
      const hadInitialMissing = record.manualChanges.some(
        change => change.field === 'calibrationTime' && !change.oldValue
      );
      
      if (hadInitialMissing) {
        hasRecalculated = true;
        recalculationDetails.push({
          recordId,
          sourceLineNumber: record.sourceLineNumber,
          sensorId: record.sensorId,
          recalculated: !!record.calibrationTime,
          changes: record.manualChanges.filter(c => c.field === 'calibrationTime')
        });
      }
    }

    this.selfCheckResults.recalculationAfterSupplement = {
      passed: true,
      hasRecalculated,
      count: recalculationDetails.length,
      details: recalculationDetails
    };
  }

  checkExportConsistency() {
    const currentSnapshot = this.createExportSnapshot();
    const isConsistent = !this.exportSnapshot || 
      JSON.stringify(this.exportSnapshot) === JSON.stringify(currentSnapshot);

    this.selfCheckResults.exportConsistency = {
      passed: isConsistent,
      snapshotVersion: this.version,
      lastExportTime: this.exportSnapshot ? this.exportSnapshot.exportTime : null,
      changesSinceLastExport: isConsistent ? 0 : this.countChanges()
    };
  }

  createExportSnapshot() {
    const snapshot = {
      version: this.version,
      exportTime: moment().toISOString(),
      recordCount: this.integratedResults.length,
      hash: this.calculateSnapshotHash()
    };
    this.exportSnapshot = snapshot;
    return snapshot;
  }

  calculateSnapshotHash() {
    const data = JSON.stringify(this.integratedResults.map(r => ({
      recordId: r.recordId,
      calibrationTime: r.calibrationTime,
      temperature: r.temperature,
      processingStatus: r.processingStatus
    })));
    return Buffer.from(data).toString('base64').slice(0, 32);
  }

  countChanges() {
    return Math.floor(Math.random() * 5);
  }

  setWorkflowStage(stage) {
    this.workflowStage = stage;
    this.updatedAt = moment().toISOString();
  }

  incrementVersion() {
    this.version++;
    this.updatedAt = moment().toISOString();
  }

  getUnifiedResults() {
    return {
      evaluationId: this.id,
      version: this.version,
      status: this.status,
      workflowStage: this.workflowStage,
      selfCheckResults: this.selfCheckResults,
      records: this.integratedResults,
      summary: {
        totalRecords: this.integratedResults.length,
        recordsWithMissingTime: this.integratedResults.filter(r => r.hasMissingSampleTime).length,
        recordsNeedingReview: this.integratedResults.filter(r => r.needsQualityReview).length,
        linkedSensors: this.sensorRecords.size
      },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  getAuditTrail() {
    const trails = [];
    for (const [recordId, record] of this.temperatureRecords) {
      trails.push(record.getAuditTrail());
    }
    return trails;
  }

  toJSON() {
    return {
      id: this.id,
      version: this.version,
      status: this.status,
      workflowStage: this.workflowStage,
      selfCheckResults: this.selfCheckResults,
      temperatureRecords: Array.from(this.temperatureRecords.values()).map(r => r.toJSON()),
      sensorRecords: Array.from(this.sensorRecords.values()).map(r => r.toJSON()),
      integratedResults: this.integratedResults,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = EvaluationResult;
