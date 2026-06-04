const { RECORD_STATUS, SAFETY_LEVEL, SensorRecord, InspectionSession, SafetyReminder } = require('./models');

class SensorDataProcessor {
  constructor() {
    this.knownSensors = new Map();
    this.sessions = new Map();
  }

  detectSensorRestart(records) {
    const restartDetections = [];
    
    for (let i = 0; i < records.length; i++) {
      const current = records[i];
      
      if (this.knownSensors.has(current.springId)) {
        const previousSensorId = this.knownSensors.get(current.springId);
        
        if (current.sensorId !== previousSensorId) {
          restartDetections.push({
            recordIndex: i,
            recordId: current.id,
            springId: current.springId,
            oldSensorId: previousSensorId,
            newSensorId: current.sensorId,
            timestamp: current.timestamp
          });
          
          current.sensorRestartDetected = true;
          current.status = RECORD_STATUS.PENDING_REVIEW;
          current.originalSensorId = previousSensorId;
        }
      }
      
      this.knownSensors.set(current.springId, current.sensorId);
    }
    
    return restartDetections;
  }

  calculateFatigueStatus(fatigueValue) {
    if (fatigueValue < 30) return SAFETY_LEVEL.SAFE;
    if (fatigueValue < 60) return SAFETY_LEVEL.WARNING;
    return SAFETY_LEVEL.DANGER;
  }

  importPhotoData(photoData) {
    const records = photoData.map((photo, index) => {
      const record = new SensorRecord({
        id: `photo-import-${Date.now()}-${index}`,
        sensorId: photo.sensorId,
        timestamp: photo.timestamp,
        springId: photo.springId,
        fatigueValue: photo.fatigueValue,
        temperature: photo.temperature,
        vibration: photo.vibration,
        photoPath: photo.path,
        status: RECORD_STATUS.NORMAL,
        runCount: 1,
        history: [{
          action: 'photo_import',
          timestamp: new Date().toISOString(),
          data: { source: 'photo', fatigueValue: photo.fatigueValue }
        }]
      });
      return record;
    });

    return records;
  }

  processSession(session) {
    const restartDetections = this.detectSensorRestart(session.records);
    
    session.records.forEach(record => {
      if (!record.sensorRestartDetected) {
        record.status = RECORD_STATUS.NORMAL;
      }
    });

    const safetyReminder = this.generateSafetyReminder(session);
    session.safetyReminder = safetyReminder.toJSON();
    session.status = 'processed';
    session.updatedAt = new Date().toISOString();

    return {
      session,
      restartDetections,
      safetyReminder
    };
  }

  generateSafetyReminder(session) {
    const dangerousRecords = session.records.filter(
      r => this.calculateFatigueStatus(r.fatigueValue) === SAFETY_LEVEL.DANGER
    );
    
    const warningRecords = session.records.filter(
      r => this.calculateFatigueStatus(r.fatigueValue) === SAFETY_LEVEL.WARNING
    );

    const restartRecords = session.records.filter(r => r.sensorRestartDetected);
    
    let level = SAFETY_LEVEL.SAFE;
    let title = '复核完成，一切正常';
    let description = '所有弹簧疲劳值均在安全范围内。';

    if (restartRecords.length > 0) {
      level = SAFETY_LEVEL.WARNING;
      title = '传感器异常需复核';
      description = `检测到 ${restartRecords.length} 条记录传感器编号发生变化，需安全员复核。`;
    } else if (dangerousRecords.length > 0) {
      level = SAFETY_LEVEL.DANGER;
      title = '危险：存在高疲劳弹簧';
      description = `发现 ${dangerousRecords.length} 个弹簧疲劳值超过安全阈值，需立即处理。`;
    } else if (warningRecords.length > 0) {
      level = SAFETY_LEVEL.WARNING;
      title = '警告：存在需关注的弹簧';
      description = `发现 ${warningRecords.length} 个弹簧疲劳值接近阈值，建议加强监测。`;
    }

    return new SafetyReminder({
      id: `reminder-${session.id}`,
      sessionId: session.id,
      level,
      title,
      description,
      affectedRecords: [
        ...dangerousRecords.map(r => r.id),
        ...warningRecords.map(r => r.id),
        ...restartRecords.map(r => r.id)
      ]
    });
  }

  applyManualNote(recordId, manualNote, session) {
    const record = session.getRecordById(recordId);
    if (!record) {
      throw new Error(`记录 ${recordId} 不存在`);
    }

    record.history.push({
      action: 'manual_note_applied',
      timestamp: new Date().toISOString(),
      data: { oldNote: record.manualNote, newNote: manualNote }
    });

    record.manualNote = manualNote;
    record.status = RECORD_STATUS.FROM_MANUAL_NOTE;

    if (manualNote.correctedFatigueValue !== undefined) {
      record.correctedFatigueValue = manualNote.correctedFatigueValue;
    }

    session.updatedAt = new Date().toISOString();
    
    return record;
  }

  reviewRecord(recordId, reviewResult, reviewer, session) {
    const record = session.getRecordById(recordId);
    if (!record) {
      throw new Error(`记录 ${recordId} 不存在`);
    }

    record.history.push({
      action: 'review_completed',
      timestamp: new Date().toISOString(),
      data: { reviewer, result: reviewResult }
    });

    record.reviewComment = reviewResult.comment;
    record.reviewedBy = reviewer;
    record.reviewedAt = new Date().toISOString();
    record.status = RECORD_STATUS.REVIEWED;

    if (reviewResult.correctedFatigueValue !== undefined) {
      record.correctedFatigueValue = reviewResult.correctedFatigueValue;
    }

    session.updatedAt = new Date().toISOString();
    
    return record;
  }

  rerunAnalysis(session) {
    session.records.forEach(record => {
      record.runCount += 1;
      record.history.push({
        action: 'rerun_analysis',
        timestamp: new Date().toISOString(),
        data: { runCount: record.runCount }
      });
    });

    const result = this.processSession(session);
    session.status = 'rerun_completed';
    
    return result;
  }

  updateSafetyReminderAfterReview(session) {
    const unreviewedRecords = session.records.filter(
      r => r.status === RECORD_STATUS.PENDING_REVIEW
    );
    
    const dangerousRecords = session.records.filter(r => {
      const fatigueValue = r.correctedFatigueValue !== null ? r.correctedFatigueValue : r.fatigueValue;
      return this.calculateFatigueStatus(fatigueValue) === SAFETY_LEVEL.DANGER;
    });

    let newLevel = SAFETY_LEVEL.SAFE;
    let updateReason = '';

    if (unreviewedRecords.length > 0) {
      newLevel = SAFETY_LEVEL.WARNING;
      updateReason = `仍有 ${unreviewedRecords.length} 条记录待复核`;
    } else if (dangerousRecords.length > 0) {
      newLevel = SAFETY_LEVEL.DANGER;
      updateReason = `存在 ${dangerousRecords.length} 个高疲劳弹簧`;
    } else {
      updateReason = '所有复核已完成，无危险记录';
    }

    if (session.safetyReminder) {
      const reminder = new SafetyReminder(session.safetyReminder);
      reminder.updateLevel(newLevel, updateReason);
      session.safetyReminder = reminder.toJSON();
    }

    session.updatedAt = new Date().toISOString();
    return session.safetyReminder;
  }
}

module.exports = {
  SensorDataProcessor
};
