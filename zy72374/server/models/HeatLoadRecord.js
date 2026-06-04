const { v4: uuidv4 } = require('uuid');

class HeatLoadRecord {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.recordDate = data.recordDate || new Date().toISOString().split('T')[0];
    this.poolId = data.poolId;
    this.poolName = data.poolName;
    this.heatLoad = data.heatLoad;
    this.unit = data.unit || 'kW';
    this.sensorData = data.sensorData || [];
    this.photoIds = data.photoIds || [];
    this.noteIds = data.noteIds || [];
    this.calculationMethod = data.calculationMethod || 'standard';
    this.calculationFormula = data.calculationFormula || '';
    this.status = data.status || 'draft';
    this.hasSensorRestart = data.hasSensorRestart || false;
    this.sensorRestartDetails = data.sensorRestartDetails || [];
    this.workflowStep = data.workflowStep || 1;
    this.createdBy = data.createdBy;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.engineerReviewedBy = data.engineerReviewedBy || null;
    this.engineerReviewedAt = data.engineerReviewedAt || null;
    this.safetyReviewedBy = data.safetyReviewedBy || null;
    this.safetyReviewedAt = data.safetyReviewedAt || null;
    this.safetyReminders = data.safetyReminders || [];
    this.version = data.version || 1;
    this.history = data.history || [];
  }

  static fromJSON(json) {
    return new HeatLoadRecord(JSON.parse(json));
  }

  toJSON() {
    return {
      id: this.id,
      recordDate: this.recordDate,
      poolId: this.poolId,
      poolName: this.poolName,
      heatLoad: this.heatLoad,
      unit: this.unit,
      sensorData: this.sensorData,
      photoIds: this.photoIds,
      noteIds: this.noteIds,
      calculationMethod: this.calculationMethod,
      calculationFormula: this.calculationFormula,
      status: this.status,
      hasSensorRestart: this.hasSensorRestart,
      sensorRestartDetails: this.sensorRestartDetails,
      workflowStep: this.workflowStep,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      engineerReviewedBy: this.engineerReviewedBy,
      engineerReviewedAt: this.engineerReviewedAt,
      safetyReviewedBy: this.safetyReviewedBy,
      safetyReviewedAt: this.safetyReviewedAt,
      safetyReminders: this.safetyReminders,
      version: this.version,
      history: this.history
    };
  }

  static calculate(inletTemp, outletTemp, flowRate, specificHeat = 4.186) {
    const deltaT = Math.abs(outletTemp - inletTemp);
    return flowRate * specificHeat * deltaT;
  }

  saveHistory(editor, changeDescription) {
    this.history.push({
      version: this.version,
      status: this.status,
      workflowStep: this.workflowStep,
      heatLoad: this.heatLoad,
      sensorData: [...this.sensorData],
      editor: editor,
      changeDescription: changeDescription,
      timestamp: new Date().toISOString()
    });
    this.version += 1;
    this.updatedAt = new Date().toISOString();
  }

  submitForEngineeringReview(editor) {
    if (this.workflowStep !== 1) {
      throw new Error('只能从第一步提交工程审核');
    }
    this.saveHistory(editor, '提交工程审核');
    this.workflowStep = 2;
    this.status = 'pending_engineer_review';
  }

  engineerApprove(engineer, notes = '') {
    if (this.workflowStep !== 2) {
      throw new Error('当前不在工程审核阶段');
    }
    this.saveHistory(engineer, `工程审核通过: ${notes}`);
    this.engineerReviewedBy = engineer;
    this.engineerReviewedAt = new Date().toISOString();
    
    if (this.hasSensorRestart) {
      this.workflowStep = 3;
      this.status = 'pending_safety_review';
    } else {
      this.workflowStep = 4;
      this.status = 'completed';
    }
  }

  engineerReject(engineer, reason) {
    if (this.workflowStep !== 2) {
      throw new Error('当前不在工程审核阶段');
    }
    this.saveHistory(engineer, `工程审核驳回: ${reason}`);
    this.workflowStep = 1;
    this.status = 'draft';
  }

  safetyApprove(safetyOfficer, reminders = []) {
    if (this.workflowStep !== 3) {
      throw new Error('当前不在安全复核阶段');
    }
    this.saveHistory(safetyOfficer, '安全复核通过');
    this.safetyReviewedBy = safetyOfficer;
    this.safetyReviewedAt = new Date().toISOString();
    this.safetyReminders = reminders;
    this.workflowStep = 4;
    this.status = 'completed';
  }

  safetyReject(safetyOfficer, reason) {
    if (this.workflowStep !== 3) {
      throw new Error('当前不在安全复核阶段');
    }
    this.saveHistory(safetyOfficer, `安全复核驳回: ${reason}`);
    this.workflowStep = 2;
    this.status = 'pending_engineer_review';
  }

  flagSensorRestart(sensorId, oldNumber, newNumber, restartTime) {
    this.hasSensorRestart = true;
    this.sensorRestartDetails.push({
      sensorId,
      oldNumber,
      newNumber,
      restartTime,
      flaggedAt: new Date().toISOString()
    });
    this.updatedAt = new Date().toISOString();
  }

  getTraceableEvidence() {
    return {
      photos: this.photoIds,
      notes: this.noteIds,
      sensorData: this.sensorData,
      calculationHistory: this.history
    };
  }

  canModify(userId, userRole) {
    if (this.status === 'completed') return false;
    
    if (this.workflowStep === 1) {
      return this.createdBy === userId || userRole === 'admin';
    }
    if (this.workflowStep === 2) {
      return userRole === 'engineer' || userRole === 'admin';
    }
    if (this.workflowStep === 3) {
      return userRole === 'safety' || userRole === 'admin';
    }
    return false;
  }
}

module.exports = HeatLoadRecord;
