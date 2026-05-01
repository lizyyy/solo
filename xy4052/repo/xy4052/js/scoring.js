/**
 * 评分与回放系统模块
 * 管理游戏评分、事件记录和回放功能
 */

const ScoreEvent = {
  PATIENT_ARRIVAL: 'patient_arrival',
  TRIAGE: 'triage',
  ACTION_START: 'action_start',
  ACTION_COMPLETE: 'action_complete',
  DETERIORATION: 'deterioration',
  DISCHARGE: 'discharge',
  RESOURCE_CONFLICT: 'resource_conflict',
  WAIT_TIMEOUT: 'wait_timeout',
  ISOLATION_MISSED: 'isolation_missed',
  GAME_START: 'game_start',
  GAME_PAUSE: 'game_pause',
  GAME_RESUME: 'game_resume',
  GAME_END: 'game_end'
};

class ScoreManager {
  constructor() {
    this.score = 0;
    this.scoreHistory = [];
    this.scoreDetails = [];
    this.patientScores = new Map();
    this.listeners = [];
  }

  addScoreListener(callback) {
    this.listeners.push(callback);
  }

  notifyScoreChange(change, reason) {
    this.listeners.forEach(callback => callback(this.score, change, reason));
  }

  getScore() {
    return this.score;
  }

  addPoints(points, reason, details = {}) {
    this.score += points;
    this.scoreHistory.push({
      points: points,
      reason: reason,
      details: details,
      timestamp: Date.now()
    });
    this.scoreDetails.push({
      points: points,
      reason: reason,
      details: details
    });
    this.notifyScoreChange(points, reason);
    return this.score;
  }

  deductPoints(points, reason, details = {}) {
    return this.addPoints(-points, reason, details);
  }

  evaluatePatient(patient) {
    const scoreImpact = patient.getScoreImpact();
    const patientId = patient.id;

    if (!this.patientScores.has(patientId)) {
      this.patientScores.set(patientId, {
        total: 0,
        details: []
      });
    }

    const patientScore = this.patientScores.get(patientId);
    patientScore.total += scoreImpact.total;
    patientScore.details.push(...scoreImpact.details);

    if (scoreImpact.total !== 0) {
      this.addPoints(scoreImpact.total, `患者${patientId}处理`, {
        patientId: patientId,
        details: scoreImpact.details
      });
    }

    return scoreImpact;
  }

  evaluateTriage(patient, triageLevel) {
    if (triageLevel !== patient.correctTriage) {
      this.deductPoints(20, '分诊级别错误', {
        patientId: patient.id,
        expected: patient.correctTriage,
        actual: triageLevel,
        message: `分诊错误：应为${patient.getTriageLevelName(patient.correctTriage)}`
      });
      return { success: false, points: -20 };
    } else {
      this.addPoints(5, '分诊正确', {
        patientId: patient.id,
        level: triageLevel
      });
      return { success: true, points: 5 };
    }
  }

  evaluateAction(patient, actionType, wasSuccessful, actionDef) {
    if (wasSuccessful) {
      const bonus = actionDef?.scoreBonus || 5;
      this.addPoints(bonus, `动作完成：${actionType}`, {
        patientId: patient.id,
        actionType: actionType
      });
      return { success: true, points: bonus };
    } else {
      this.deductPoints(10, `动作失败：${actionType}`, {
        patientId: patient.id,
        actionType: actionType
      });
      return { success: false, points: -10 };
    }
  }

  evaluateDeterioration(patient, reason) {
    this.deductPoints(30, '患者病情恶化', {
      patientId: patient.id,
      reason: reason
    });
    return { points: -30 };
  }

  evaluateResourceConflict(patientId, resourceType) {
    this.deductPoints(10, '资源重复占用', {
      patientId: patientId,
      resourceType: resourceType
    });
    return { points: -10 };
  }

  evaluateWaitTimeout(patientId, waitTime) {
    this.deductPoints(10, '患者等待超时', {
      patientId: patientId,
      waitTime: waitTime
    });
    return { points: -10 };
  }

  evaluateIsolationMissed(patientId) {
    this.deductPoints(15, '隔离措施漏做', {
      patientId: patientId
    });
    return { points: -15 };
  }

  evaluateCorrectHandling(patientId) {
    this.addPoints(20, '高危患者正确处理', {
      patientId: patientId
    });
    return { points: 20 };
  }

  getScoreDetails() {
    return [...this.scoreDetails];
  }

  getScoreHistory() {
    return [...this.scoreHistory];
  }

  getPatientScores() {
    const result = {};
    for (const [patientId, data] of this.patientScores) {
      result[patientId] = { ...data };
    }
    return result;
  }

  getRating() {
    const score = this.score;
    if (score >= 80) return { grade: 'A', label: '优秀', color: '#4CAF50' };
    if (score >= 60) return { grade: 'B', label: '良好', color: '#2196F3' };
    if (score >= 40) return { grade: 'C', label: '合格', color: '#FF9800' };
    if (score >= 20) return { grade: 'D', label: '待改进', color: '#FF5722' };
    return { grade: 'F', label: '不合格', color: '#F44336' };
  }

  reset() {
    this.score = 0;
    this.scoreHistory = [];
    this.scoreDetails = [];
    this.patientScores.clear();
  }

  toJSON() {
    return {
      score: this.score,
      scoreHistory: [...this.scoreHistory],
      scoreDetails: [...this.scoreDetails],
      patientScores: this.getPatientScores(),
      rating: this.getRating()
    };
  }
}

class ReplayManager {
  constructor() {
    this.events = [];
    this.startTime = null;
    this.isRecording = false;
    this.listeners = [];
  }

  addReplayListener(callback) {
    this.listeners.push(callback);
  }

  notifyEvent(event) {
    this.listeners.forEach(callback => callback(event));
  }

  startRecording() {
    this.isRecording = true;
    this.startTime = Date.now();
    this.events = [];
    this.recordEvent(ScoreEvent.GAME_START, {
      timestamp: 0
    });
  }

  stopRecording() {
    this.isRecording = false;
    this.recordEvent(ScoreEvent.GAME_END, {
      timestamp: this.getElapsedTime()
    });
  }

  getElapsedTime() {
    if (!this.startTime) return 0;
    return (Date.now() - this.startTime) / 1000;
  }

  recordEvent(eventType, data = {}) {
    if (!this.isRecording) return;

    const event = {
      type: eventType,
      timestamp: this.getElapsedTime(),
      data: { ...data }
    };

    this.events.push(event);
    this.notifyEvent(event);
  }

  recordPatientArrival(patient) {
    this.recordEvent(ScoreEvent.PATIENT_ARRIVAL, {
      patientId: patient.id,
      chiefComplaint: patient.chiefComplaint,
      vitalSigns: { ...patient.vitalSigns },
      arrivalTime: patient.arrivalTime
    });
  }

  recordTriage(patient, triageLevel, wasCorrect) {
    this.recordEvent(ScoreEvent.TRIAGE, {
      patientId: patient.id,
      triageLevel: triageLevel,
      wasCorrect: wasCorrect,
      correctTriage: patient.correctTriage
    });
  }

  recordActionStart(patient, actionType, resources) {
    this.recordEvent(ScoreEvent.ACTION_START, {
      patientId: patient.id,
      actionType: actionType,
      resources: [...resources]
    });
  }

  recordActionComplete(patient, actionType, wasSuccessful) {
    this.recordEvent(ScoreEvent.ACTION_COMPLETE, {
      patientId: patient.id,
      actionType: actionType,
      wasSuccessful: wasSuccessful
    });
  }

  recordDeterioration(patient, reason) {
    this.recordEvent(ScoreEvent.DETERIORATION, {
      patientId: patient.id,
      reason: reason
    });
  }

  recordDischarge(patient, wasSuccessful) {
    this.recordEvent(ScoreEvent.DISCHARGE, {
      patientId: patient.id,
      wasSuccessful: wasSuccessful
    });
  }

  recordResourceConflict(patientId, resourceType) {
    this.recordEvent(ScoreEvent.RESOURCE_CONFLICT, {
      patientId: patientId,
      resourceType: resourceType
    });
  }

  recordWaitTimeout(patientId, waitTime) {
    this.recordEvent(ScoreEvent.WAIT_TIMEOUT, {
      patientId: patientId,
      waitTime: waitTime
    });
  }

  recordIsolationMissed(patientId) {
    this.recordEvent(ScoreEvent.ISOLATION_MISSED, {
      patientId: patientId
    });
  }

  getEvents() {
    return [...this.events];
  }

  getEventsByType(eventType) {
    return this.events.filter(e => e.type === eventType);
  }

  getEventsByPatient(patientId) {
    return this.events.filter(e => e.data.patientId === patientId);
  }

  getEventTimeline() {
    const timeline = [];
    const sortedEvents = [...this.events].sort((a, b) => a.timestamp - b.timestamp);

    for (const event of sortedEvents) {
      timeline.push({
        time: event.timestamp,
        type: event.type,
        description: this.getEventDescription(event)
      });
    }

    return timeline;
  }

  getEventDescription(event) {
    const descriptions = {
      [ScoreEvent.GAME_START]: '游戏开始',
      [ScoreEvent.GAME_END]: '游戏结束',
      [ScoreEvent.PATIENT_ARRIVAL]: `患者${event.data.patientId}到达：${event.data.chiefComplaint}`,
      [ScoreEvent.TRIAGE]: `患者${event.data.patientId}分诊为${event.data.triageLevel}（${event.data.wasCorrect ? '正确' : '错误'}）`,
      [ScoreEvent.ACTION_START]: `患者${event.data.patientId}开始${event.data.actionType}`,
      [ScoreEvent.ACTION_COMPLETE]: `患者${event.data.patientId}完成${event.data.actionType}（${event.data.wasSuccessful ? '成功' : '失败'}）`,
      [ScoreEvent.DETERIORATION]: `患者${event.data.patientId}病情恶化：${event.data.reason}`,
      [ScoreEvent.DISCHARGE]: `患者${event.data.patientId}出院（${event.data.wasSuccessful ? '成功' : '失败'}）`,
      [ScoreEvent.RESOURCE_CONFLICT]: `患者${event.data.patientId}资源冲突：${event.data.resourceType}`,
      [ScoreEvent.WAIT_TIMEOUT]: `患者${event.data.patientId}等待超时：${event.data.waitTime}秒`,
      [ScoreEvent.ISOLATION_MISSED]: `患者${event.data.patientId}隔离措施漏做`
    };
    return descriptions[event.type] || event.type;
  }

  getErrorAnalysis() {
    const errors = [];

    const triageErrors = this.getEventsByType(ScoreEvent.TRIAGE)
      .filter(e => !e.data.wasCorrect);

    for (const event of triageErrors) {
      errors.push({
        time: event.timestamp,
        type: '分诊错误',
        patientId: event.data.patientId,
        description: `分诊错误：应为${event.data.correctTriage}，实际为${event.data.triageLevel}`,
        suggestion: '请重新学习分诊标准，特别关注高危患者的识别'
      });
    }

    const deteriorationEvents = this.getEventsByType(ScoreEvent.DETERIORATION);
    for (const event of deteriorationEvents) {
      errors.push({
        time: event.timestamp,
        type: '病情恶化',
        patientId: event.data.patientId,
        description: `患者病情恶化：${event.data.reason}`,
        suggestion: '请关注患者等待时间，及时处理高危患者'
      });
    }

    const isolationMissed = this.getEventsByType(ScoreEvent.ISOLATION_MISSED);
    for (const event of isolationMissed) {
      errors.push({
        time: event.timestamp,
        type: '隔离漏做',
        patientId: event.data.patientId,
        description: '隔离措施漏做',
        suggestion: '请关注需要隔离的患者，及时采取隔离措施'
      });
    }

    const resourceConflicts = this.getEventsByType(ScoreEvent.RESOURCE_CONFLICT);
    for (const event of resourceConflicts) {
      errors.push({
        time: event.timestamp,
        type: '资源冲突',
        patientId: event.data.patientId,
        description: `资源冲突：${event.data.resourceType}`,
        suggestion: '请合理安排资源使用，避免重复占用'
      });
    }

    return errors;
  }

  reset() {
    this.events = [];
    this.startTime = null;
    this.isRecording = false;
  }

  toJSON() {
    return {
      events: [...this.events],
      startTime: this.startTime,
      isRecording: this.isRecording
    };
  }

  fromJSON(data) {
    this.events = [...(data.events || [])];
    this.startTime = data.startTime || null;
    this.isRecording = data.isRecording || false;
  }
}

export {
  ScoreEvent,
  ScoreManager,
  ReplayManager
};
