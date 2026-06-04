const HeatLoadRecord = require('../models/HeatLoadRecord');
const store = require('../store/DataStore');
const SensorService = require('./SensorService');
const PhotoService = require('./PhotoService');
const NoteService = require('./NoteService');

class HeatLoadService {
  static createRecord(data) {
    const record = new HeatLoadRecord(data);
    return store.create('heatLoads', record.toJSON());
  }

  static calculateHeatLoad(inletTemp, outletTemp, flowRate, specificHeat = 4.186) {
    return HeatLoadRecord.calculate(inletTemp, outletTemp, flowRate, specificHeat);
  }

  static getRecordById(id) {
    return store.findById('heatLoads', id);
  }

  static getRecordsByDate(date) {
    return store.find('heatLoads', r => r.recordDate === date);
  }

  static getRecordsByPool(poolId) {
    return store.find('heatLoads', r => r.poolId === poolId);
  }

  static getRecordsByStatus(status) {
    return store.find('heatLoads', r => r.status === status);
  }

  static getRecordsByWorkflowStep(step) {
    return store.find('heatLoads', r => r.workflowStep === step);
  }

  static getAllRecords() {
    return store.findAll('heatLoads');
  }

  static getPendingEngineeringReview() {
    return this.getRecordsByWorkflowStep(2);
  }

  static getPendingSafetyReview() {
    return this.getRecordsByWorkflowStep(3);
  }

  static submitForEngineeringReview(id, editor) {
    const recordData = this.getRecordById(id);
    if (!recordData) return null;
    
    const record = new HeatLoadRecord(recordData);
    try {
      record.submitForEngineeringReview(editor);
      return store.update('heatLoads', id, record.toJSON());
    } catch (e) {
      return { error: e.message };
    }
  }

  static engineerApprove(id, engineer, notes = '') {
    const recordData = this.getRecordById(id);
    if (!recordData) return null;
    
    const record = new HeatLoadRecord(recordData);
    try {
      record.engineerApprove(engineer, notes);
      return store.update('heatLoads', id, record.toJSON());
    } catch (e) {
      return { error: e.message };
    }
  }

  static engineerReject(id, engineer, reason) {
    const recordData = this.getRecordById(id);
    if (!recordData) return null;
    
    const record = new HeatLoadRecord(recordData);
    try {
      record.engineerReject(engineer, reason);
      return store.update('heatLoads', id, record.toJSON());
    } catch (e) {
      return { error: e.message };
    }
  }

  static safetyApprove(id, safetyOfficer, reminders = []) {
    const recordData = this.getRecordById(id);
    if (!recordData) return null;
    
    const record = new HeatLoadRecord(recordData);
    try {
      record.safetyApprove(safetyOfficer, reminders);
      return store.update('heatLoads', id, record.toJSON());
    } catch (e) {
      return { error: e.message };
    }
  }

  static safetyReject(id, safetyOfficer, reason) {
    const recordData = this.getRecordById(id);
    if (!recordData) return null;
    
    const record = new HeatLoadRecord(recordData);
    try {
      record.safetyReject(safetyOfficer, reason);
      return store.update('heatLoads', id, record.toJSON());
    } catch (e) {
      return { error: e.message };
    }
  }

  static addPhotoToRecord(recordId, photoId) {
    const record = this.getRecordById(recordId);
    if (!record) return null;

    const photoIds = record.photoIds.includes(photoId) 
      ? record.photoIds 
      : [...record.photoIds, photoId];

    return store.update('heatLoads', recordId, { photoIds });
  }

  static addNoteToRecord(recordId, noteId) {
    const record = this.getRecordById(recordId);
    if (!record) return null;

    const noteIds = record.noteIds.includes(noteId) 
      ? record.noteIds 
      : [...record.noteIds, noteId];

    return store.update('heatLoads', recordId, { noteIds });
  }

  static checkSensorRestart(recordId) {
    const record = this.getRecordById(recordId);
    if (!record) return null;

    const restartDetails = [];
    
    record.sensorData.forEach(sensorReading => {
      const result = SensorService.resolveSensorConflict(
        sensorReading.sensorNumber,
        record.recordDate
      );
      
      if (result.status === 'conflict' || result.status === 'resolved') {
        const sensor = result.sensor || result.candidates[0];
        if (sensor && sensor.restartCount > 0) {
          restartDetails.push({
            sensorId: sensor.id,
            physicalId: sensor.physicalId,
            sensorNumber: sensorReading.sensorNumber,
            hasRestarted: sensor.restartCount > 0,
            restartCount: sensor.restartCount
          });
        }
      }
    });

    if (restartDetails.length > 0) {
      const recordData = new HeatLoadRecord(record);
      restartDetails.forEach(detail => {
        recordData.flagSensorRestart(
          detail.sensorId,
          detail.sensorNumber,
          detail.sensorNumber,
          record.recordDate
        );
      });
      return store.update('heatLoads', recordId, recordData.toJSON());
    }

    return record;
  }

  static getRecordWithEvidence(id) {
    const record = this.getRecordById(id);
    if (!record) return null;

    const photos = record.photoIds
      .map(pid => PhotoService.getPhotoById(pid))
      .filter(Boolean);

    const notes = record.noteIds
      .map(nid => NoteService.getNoteById(nid))
      .filter(Boolean);

    const recordData = new HeatLoadRecord(record);

    return {
      record,
      photos,
      notes,
      traceableEvidence: recordData.getTraceableEvidence(),
      history: record.history
    };
  }

  static getRecordHistory(id) {
    const record = this.getRecordById(id);
    if (!record) return null;

    return {
      id: record.id,
      currentVersion: record.version,
      currentStatus: record.status,
      workflowStep: record.workflowStep,
      history: record.history
    };
  }

  static updateHeatLoadValue(id, heatLoad, editor, reason) {
    const recordData = this.getRecordById(id);
    if (!recordData) return null;

    const record = new HeatLoadRecord(recordData);
    record.saveHistory(editor, `更新换热负荷值: ${reason}`);
    record.heatLoad = heatLoad;

    return store.update('heatLoads', id, record.toJSON());
  }

  static canModifyRecord(id, userId, userRole) {
    const recordData = this.getRecordById(id);
    if (!recordData) return false;

    const record = new HeatLoadRecord(recordData);
    return record.canModify(userId, userRole);
  }

  static getWorkflowSummary() {
    const allRecords = this.getAllRecords();
    
    return {
      total: allRecords.length,
      draft: allRecords.filter(r => r.workflowStep === 1).length,
      pendingEngineering: allRecords.filter(r => r.workflowStep === 2).length,
      pendingSafety: allRecords.filter(r => r.workflowStep === 3).length,
      completed: allRecords.filter(r => r.workflowStep === 4).length,
      hasSensorRestart: allRecords.filter(r => r.hasSensorRestart).length
    };
  }

  static deleteRecord(id) {
    return store.delete('heatLoads', id);
  }

  static getChartData(poolId, startDate, endDate) {
    const records = store.find('heatLoads', r => {
      return r.poolId === poolId && 
             r.recordDate >= startDate && 
             r.recordDate <= endDate &&
             r.status === 'completed';
    });

    return records.map(r => ({
      date: r.recordDate,
      heatLoad: r.heatLoad,
      hasSensorRestart: r.hasSensorRestart,
      recordId: r.id
    })).sort((a, b) => a.date.localeCompare(b.date));
  }
}

module.exports = HeatLoadService;
