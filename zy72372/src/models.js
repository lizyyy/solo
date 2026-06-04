const RECORD_STATUS = {
  NORMAL: 'normal',
  SENSOR_RESTART: 'sensor_restart',
  PENDING_REVIEW: 'pending_review',
  FROM_MANUAL_NOTE: 'from_manual_note',
  REVIEWED: 'reviewed'
};

const SAFETY_LEVEL = {
  SAFE: 'safe',
  WARNING: 'warning',
  DANGER: 'danger',
  UNKNOWN: 'unknown'
};

class SensorRecord {
  constructor(data) {
    this.id = data.id;
    this.sensorId = data.sensorId;
    this.originalSensorId = data.originalSensorId || data.sensorId;
    this.timestamp = data.timestamp;
    this.springId = data.springId;
    this.fatigueValue = data.fatigueValue;
    this.temperature = data.temperature;
    this.vibration = data.vibration;
    this.status = data.status || RECORD_STATUS.NORMAL;
    this.photoPath = data.photoPath || null;
    this.manualNote = data.manualNote || null;
    this.sensorRestartDetected = data.sensorRestartDetected || false;
    this.reviewComment = data.reviewComment || null;
    this.reviewedBy = data.reviewedBy || null;
    this.reviewedAt = data.reviewedAt || null;
    this.correctedFatigueValue = data.correctedFatigueValue || null;
    this.runCount = data.runCount || 1;
    this.history = data.history || [];
  }

  toJSON() {
    return {
      id: this.id,
      sensorId: this.sensorId,
      originalSensorId: this.originalSensorId,
      timestamp: this.timestamp,
      springId: this.springId,
      fatigueValue: this.fatigueValue,
      temperature: this.temperature,
      vibration: this.vibration,
      status: this.status,
      photoPath: this.photoPath,
      manualNote: this.manualNote,
      sensorRestartDetected: this.sensorRestartDetected,
      reviewComment: this.reviewComment,
      reviewedBy: this.reviewedBy,
      reviewedAt: this.reviewedAt,
      correctedFatigueValue: this.correctedFatigueValue,
      runCount: this.runCount,
      history: this.history
    };
  }
}

class InspectionSession {
  constructor(data) {
    this.id = data.id;
    this.date = data.date;
    this.inspector = data.inspector;
    this.location = data.location;
    this.records = (data.records || []).map(r => new SensorRecord(r));
    this.photos = data.photos || [];
    this.manualNotes = data.manualNotes || [];
    this.status = data.status || 'imported';
    this.safetyReminder = data.safetyReminder || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  addRecord(record) {
    this.records.push(new SensorRecord(record));
    this.updatedAt = new Date().toISOString();
  }

  getRecordById(id) {
    return this.records.find(r => r.id === id);
  }

  getRecordsByStatus(status) {
    return this.records.filter(r => r.status === status);
  }

  toJSON() {
    return {
      id: this.id,
      date: this.date,
      inspector: this.inspector,
      location: this.location,
      records: this.records.map(r => r.toJSON()),
      photos: this.photos,
      manualNotes: this.manualNotes,
      status: this.status,
      safetyReminder: this.safetyReminder,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

class SafetyReminder {
  constructor(data) {
    this.id = data.id;
    this.sessionId = data.sessionId;
    this.level = data.level || SAFETY_LEVEL.UNKNOWN;
    this.title = data.title;
    this.description = data.description;
    this.affectedRecords = data.affectedRecords || [];
    this.generatedAt = data.generatedAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.acknowledged = data.acknowledged || false;
    this.acknowledgedBy = data.acknowledgedBy || null;
    this.acknowledgedAt = data.acknowledgedAt || null;
  }

  updateLevel(newLevel, reason) {
    const oldLevel = this.level;
    this.level = newLevel;
    this.description += `\n[更新] 安全等级从 ${oldLevel} 变更为 ${newLevel}，原因：${reason}`;
    this.updatedAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      sessionId: this.sessionId,
      level: this.level,
      title: this.title,
      description: this.description,
      affectedRecords: this.affectedRecords,
      generatedAt: this.generatedAt,
      updatedAt: this.updatedAt,
      acknowledged: this.acknowledged,
      acknowledgedBy: this.acknowledgedBy,
      acknowledgedAt: this.acknowledgedAt
    };
  }
}

module.exports = {
  RECORD_STATUS,
  SAFETY_LEVEL,
  SensorRecord,
  InspectionSession,
  SafetyReminder
};
