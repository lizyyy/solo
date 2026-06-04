const { SAFETY_LEVEL } = require('./models');

class SafetyReminderManager {
  constructor() {
    this.reminders = [];
  }

  createReminder(session, records, detections) {
    const dangerousRecords = records.filter(
      r => this.getFatigueLevel(r.fatigueValue) === SAFETY_LEVEL.DANGER
    );
    
    const warningRecords = records.filter(
      r => this.getFatigueLevel(r.fatigueValue) === SAFETY_LEVEL.WARNING
    );

    const pendingReviewRecords = records.filter(r => r.status === 'pending_review');

    let level = SAFETY_LEVEL.SAFE;
    let title = '复核完成，一切正常';
    let description = '所有弹簧疲劳值均在安全范围内。';

    if (pendingReviewRecords.length > 0) {
      level = SAFETY_LEVEL.WARNING;
      title = '传感器异常需复核';
      description = `检测到 ${pendingReviewRecords.length} 条记录传感器编号发生变化，需安全员复核。`;
      
      if (detections && detections.length > 0) {
        description += '\n检测详情:';
        detections.forEach(d => {
          description += `\n  • 弹簧 ${d.springId}: ${d.oldSensorId} → ${d.newSensorId}`;
        });
      }
    } else if (dangerousRecords.length > 0) {
      level = SAFETY_LEVEL.DANGER;
      title = '危险：存在高疲劳弹簧';
      description = `发现 ${dangerousRecords.length} 个弹簧疲劳值超过安全阈值(≥60)，需立即处理。`;
    } else if (warningRecords.length > 0) {
      level = SAFETY_LEVEL.WARNING;
      title = '警告：存在需关注的弹簧';
      description = `发现 ${warningRecords.length} 个弹簧疲劳值接近阈值(30-60)，建议加强监测。`;
    }

    const reminder = {
      id: `reminder-${Date.now()}`,
      sessionId: session.id,
      level,
      title,
      description,
      affectedRecords: records.filter(r => 
        this.getFatigueLevel(r.fatigueValue) !== SAFETY_LEVEL.SAFE || 
        r.status === 'pending_review'
      ).map(r => r.id),
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      acknowledged: false,
      history: [{
        action: 'created',
        timestamp: new Date().toISOString(),
        level,
        description
      }]
    };

    this.reminders.push(reminder);
    return reminder;
  }

  updateReminderAfterReview(reminderId, session) {
    const reminder = this.reminders.find(r => r.id === reminderId);
    if (!reminder) return null;

    const pendingReviewRecords = session.records.filter(r => r.status === 'pending_review');
    const dangerousRecords = session.records.filter(r => {
      const fatigueValue = r.correctedFatigueValue !== null ? r.correctedFatigueValue : r.fatigueValue;
      return this.getFatigueLevel(fatigueValue) === SAFETY_LEVEL.DANGER;
    });

    let newLevel = SAFETY_LEVEL.SAFE;
    let updateReason = '';

    if (pendingReviewRecords.length > 0) {
      newLevel = SAFETY_LEVEL.WARNING;
      updateReason = `仍有 ${pendingReviewRecords.length} 条记录待安全员复核`;
    } else if (dangerousRecords.length > 0) {
      newLevel = SAFETY_LEVEL.DANGER;
      updateReason = `存在 ${dangerousRecords.length} 个高疲劳弹簧需要处理`;
    } else {
      updateReason = '所有复核已完成，确认无危险记录';
    }

    const oldLevel = reminder.level;
    reminder.level = newLevel;
    reminder.updatedAt = new Date().toISOString();
    
    if (oldLevel !== newLevel) {
      reminder.description += `\n[更新] 安全等级从 ${oldLevel} 变更为 ${newLevel}，原因：${updateReason}`;
    } else {
      reminder.description += `\n[更新] ${updateReason}`;
    }

    reminder.history.push({
      action: 'updated',
      timestamp: new Date().toISOString(),
      oldLevel,
      newLevel,
      reason: updateReason
    });

    return reminder;
  }

  getFatigueLevel(fatigueValue) {
    if (fatigueValue < 30) return SAFETY_LEVEL.SAFE;
    if (fatigueValue < 60) return SAFETY_LEVEL.WARNING;
    return SAFETY_LEVEL.DANGER;
  }

  acknowledgeReminder(reminderId, acknowledgedBy) {
    const reminder = this.reminders.find(r => r.id === reminderId);
    if (!reminder) return null;

    reminder.acknowledged = true;
    reminder.acknowledgedBy = acknowledgedBy;
    reminder.acknowledgedAt = new Date().toISOString();
    reminder.history.push({
      action: 'acknowledged',
      timestamp: new Date().toISOString(),
      acknowledgedBy
    });

    return reminder;
  }

  getRemindersBySession(sessionId) {
    return this.reminders.filter(r => r.sessionId === sessionId);
  }

  getActiveReminders() {
    return this.reminders.filter(r => !r.acknowledged);
  }
}

module.exports = {
  SafetyReminder: SafetyReminderManager
};
