const { ConflictSeverity, ConflictType } = require('./ResourceTypes');

class Conflict {
  constructor(data) {
    this.id = data.id || this._generateId();
    this.appointmentId1 = data.appointmentId1;
    this.appointmentId2 = data.appointmentId2;
    this.resourceType = data.resourceType;
    this.resourceId = data.resourceId;
    this.conflictType = data.conflictType || ConflictType.OVERLAP;
    this.overlapMinutes = data.overlapMinutes || 0;
    this.affectedSlots = data.affectedSlots || [];
    this.severity = data.severity || this._determineSeverity();
    this.description = data.description || this._generateDescription();
    this.suggestion = data.suggestion || this._generateSuggestion();
    this.createdAt = new Date();
  }

  _generateId() {
    return 'conflict_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  _determineSeverity() {
    if (this.overlapMinutes > 30) {
      return ConflictSeverity.HIGH;
    } else if (this.overlapMinutes > 0) {
      return ConflictSeverity.MEDIUM;
    }
    return ConflictSeverity.LOW;
  }

  _generateDescription() {
    const resourceNames = {
      doctor: '医生',
      room: '诊室',
      equipment: '设备'
    };
    const typeNames = {
      overlap: '时间重叠',
      time_window_violation: '时间窗口违规',
      capacity_exceeded: '容量超出'
    };
    return `${resourceNames[this.resourceType]} [${this.resourceId}] 存在${typeNames[this.conflictType]}冲突`;
  }

  _generateSuggestion() {
    const suggestions = {
      doctor: '建议调整其中一个预约的时间，或安排其他医生',
      room: '建议调整其中一个预约的时间，或使用其他诊室',
      equipment: '建议调整预约顺序，或使用其他同类设备'
    };
    
    if (this.overlapMinutes > 30) {
      return `严重冲突！${suggestions[this.resourceType]}`;
    }
    return suggestions[this.resourceType];
  }

  toJSON() {
    return {
      id: this.id,
      appointmentId1: this.appointmentId1,
      appointmentId2: this.appointmentId2,
      resourceType: this.resourceType,
      resourceId: this.resourceId,
      conflictType: this.conflictType,
      severity: this.severity,
      description: this.description,
      overlapMinutes: this.overlapMinutes,
      affectedSlots: this.affectedSlots,
      suggestion: this.suggestion,
      createdAt: this.createdAt.toISOString()
    };
  }
}

module.exports = Conflict;
