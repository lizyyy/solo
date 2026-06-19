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

  static createRecordFromPhotos(photoIds, batchId, createdBy, extraData = {}) {
    if (!photoIds || photoIds.length === 0) {
      return { error: '请至少选择一张照片' };
    }

    const photos = photoIds.map(id => PhotoService.getPhotoById(id)).filter(Boolean);
    if (photos.length === 0) {
      return { error: '照片不存在' };
    }

    const sensorNumbers = new Set();
    photos.forEach(p => {
      if (p.sensorNumbers) {
        p.sensorNumbers.forEach(s => sensorNumbers.add(s));
      }
    });

    const allSensors = [];
    const hasSensorRestart = Array.from(sensorNumbers).some(sn => {
      const sensor = SensorService.getSensorByCurrentNumber(sn);
      if (sensor) {
        allSensors.push(sensor);
        return sensor.previousNumbers && sensor.previousNumbers.length > 0;
      }
      return false;
    });

    const inletTemp = extraData.inletTemp || (25 + Math.random() * 5);
    const outletTemp = extraData.outletTemp || (35 + Math.random() * 5);
    const flowRate = extraData.flowRate || (10 + Math.random() * 5);
    const specificHeat = 4.186;
    const deltaT = Math.abs(outletTemp - inletTemp);
    const heatLoad = parseFloat((flowRate * specificHeat * deltaT).toFixed(2));
    const calculationFormula = `Q = G × C × ΔT = ${flowRate} × ${specificHeat} × ${deltaT.toFixed(2)} = ${heatLoad} kW`;

    const sensorData = [];
    const sensorNumberArray = Array.from(sensorNumbers);
    if (sensorNumberArray.length >= 2) {
      sensorData.push({
        sensorNumber: sensorNumberArray[0],
        inletTemp: inletTemp,
        outletTemp: null,
        flowRate: null,
        type: 'inlet'
      });
      sensorData.push({
        sensorNumber: sensorNumberArray[1],
        inletTemp: null,
        outletTemp: outletTemp,
        flowRate: null,
        type: 'outlet'
      });
      if (sensorNumberArray.length >= 3) {
        sensorData.push({
          sensorNumber: sensorNumberArray[2],
          inletTemp: null,
          outletTemp: null,
          flowRate: flowRate,
          type: 'flow'
        });
      }
    } else {
      sensorData.push({
        sensorNumber: sensorNumberArray[0] || 'T-UNKNOWN',
        inletTemp: inletTemp,
        outletTemp: outletTemp,
        flowRate: flowRate,
        type: 'combo'
      });
    }

    const recordData = {
      photoIds: photoIds,
      importBatchId: batchId,
      createdBy: createdBy,
      poolId: extraData.poolId || 'pool-main',
      poolName: extraData.poolName || '主游泳池',
      poolArea: extraData.poolArea || 500,
      targetTemp: extraData.targetTemp || 28,
      ambientTemp: extraData.ambientTemp || 20,
      recordDate: extraData.recordDate || new Date().toISOString().split('T')[0],
      hasSensorRestart: hasSensorRestart,
      sensorData: sensorData,
      heatLoad: heatLoad,
      unit: 'kW',
      calculationMethod: 'standard',
      calculationFormula: calculationFormula
    };

    const record = new HeatLoadRecord(recordData);
    record.saveHistory(createdBy, `从工况照片创建记录，导入批次: ${batchId}`);
    const saved = store.create('heatLoads', record.toJSON());
    
    return saved;
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
