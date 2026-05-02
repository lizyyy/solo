/**
 * 患者状态机模块
 * 管理患者的状态转换和行为
 */

const PatientState = {
  PENDING: 'pending',
  TRIAGED: 'triaged',
  BEING_TREATED: 'being_treated',
  WAITING: 'waiting',
  DISCHARGED: 'discharged',
  DETERIORATED: 'deteriorated',
  DECEASED: 'deceased'
};

const TriageLevel = {
  RED: 'red',
  YELLOW: 'yellow',
  GREEN: 'green',
  OBSERVATION: 'observation'
};

class Patient {
  constructor(data) {
    this.id = data.id;
    this.arrivalTime = data.arrivalTime;
    this.chiefComplaint = data.chiefComplaint;
    this.vitalSigns = data.vitalSigns || {};
    this.riskFactors = data.riskFactors || [];
    this.correctTriage = data.correctTriage;
    this.requiredActions = data.requiredActions || [];
    this.deteriorationTime = data.deteriorationTime || 300;
    this.familyStress = data.familyStress || 0;
    this.description = data.description || '';
    
    this.state = PatientState.PENDING;
    this.currentTriage = null;
    this.waitTime = 0;
    this.completedActions = [];
    this.currentAction = null;
    this.hasDeteriorated = false;
    this.triageErrors = [];
    this.actionErrors = [];
    this.isolationStatus = data.needsIsolation || false;
    this.isolationPerformed = false;
    
    this.stateListeners = [];
    this.updateListeners = [];
  }

  addStateListener(callback) {
    this.stateListeners.push(callback);
  }

  addUpdateListener(callback) {
    this.updateListeners.push(callback);
  }

  notifyStateChange(oldState, newState) {
    this.stateListeners.forEach(callback => callback(this, oldState, newState));
  }

  notifyUpdate() {
    this.updateListeners.forEach(callback => callback(this));
  }

  triage(level) {
    if (this.state !== PatientState.PENDING && this.state !== PatientState.WAITING) {
      return { success: false, message: '患者状态不允许分诊' };
    }

    const oldState = this.state;
    this.currentTriage = level;
    this.state = PatientState.TRIAGED;

    if (level !== this.correctTriage) {
      this.triageErrors.push({
        time: Date.now(),
        expected: this.correctTriage,
        actual: level,
        message: `分诊错误：应为${this.getTriageLevelName(this.correctTriage)}，实际为${this.getTriageLevelName(level)}`
      });
    }

    this.notifyStateChange(oldState, this.state);
    this.notifyUpdate();
    return { success: true, message: '分诊完成' };
  }

  startAction(actionId) {
    if (this.currentAction) {
      return { success: false, message: '患者正在进行其他操作' };
    }

    const oldState = this.state;
    this.currentAction = actionId;
    this.state = PatientState.BEING_TREATED;
    this.notifyStateChange(oldState, this.state);
    this.notifyUpdate();
    return { success: true, message: `开始${actionId}` };
  }

  completeAction(actionId, wasSuccessful = true) {
    if (this.currentAction !== actionId) {
      return { success: false, message: '当前操作不匹配' };
    }

    this.completedActions.push({
      actionId: actionId,
      time: Date.now(),
      successful: wasSuccessful
    });

    this.currentAction = null;

    if (this.isolationStatus && actionId === 'isolation') {
      this.isolationPerformed = true;
    }

    const allRequiredCompleted = this.requiredActions.every(
      action => this.completedActions.some(c => c.actionId === action)
    );

    const oldState = this.state;
    if (allRequiredCompleted) {
      this.state = PatientState.DISCHARGED;
      this.notifyStateChange(oldState, this.state);
      this.notifyUpdate();
      return { success: true, message: '患者处理完成，可以出院', discharged: true };
    } else {
      this.state = PatientState.WAITING;
      this.notifyStateChange(oldState, this.state);
      this.notifyUpdate();
      return { success: true, message: '操作完成，患者等待下一步处理' };
    }
  }

  updateWaitTime(deltaTime) {
    if (this.state === PatientState.WAITING || this.state === PatientState.PENDING) {
      this.waitTime += deltaTime;
      this.familyStress = Math.min(100, this.familyStress + deltaTime * 0.1);
      this.checkDeterioration();
      this.notifyUpdate();
    }
  }

  checkDeterioration() {
    if (this.hasDeteriorated) return false;

    if (this.waitTime > this.deteriorationTime) {
      this.deteriorate();
      return true;
    }

    if (this.triageErrors.length > 0) {
      const triageError = this.triageErrors[0];
      const timeSinceError = (Date.now() - triageError.time) / 1000;
      if (timeSinceError > 60) {
        this.deteriorate();
        return true;
      }
    }

    if (this.isolationStatus && !this.isolationPerformed && this.waitTime > 120) {
      this.deteriorate();
      return true;
    }

    return false;
  }

  deteriorate() {
    if (this.hasDeteriorated) return;

    this.hasDeteriorated = true;
    const oldState = this.state;
    this.state = PatientState.DETERIORATED;
    this.actionErrors.push({
      time: Date.now(),
      message: '患者病情恶化',
      reason: this.getDeteriorationReason()
    });
    this.notifyStateChange(oldState, this.state);
    this.notifyUpdate();
  }

  getDeteriorationReason() {
    if (this.waitTime > this.deteriorationTime) {
      return '等待时间过长';
    }
    if (this.triageErrors.length > 0) {
      return '分诊级别判断错误';
    }
    if (this.isolationStatus && !this.isolationPerformed) {
      return '隔离措施漏做';
    }
    return '未知原因';
  }

  getTriageLevelName(level) {
    const names = {
      [TriageLevel.RED]: '红色（急危重症）',
      [TriageLevel.YELLOW]: '黄色（急症）',
      [TriageLevel.GREEN]: '绿色（轻症）',
      [TriageLevel.OBSERVATION]: '留观'
    };
    return names[level] || level;
  }

  getStateName() {
    const names = {
      [PatientState.PENDING]: '待分诊',
      [PatientState.TRIAGED]: '已分诊',
      [PatientState.BEING_TREATED]: '处理中',
      [PatientState.WAITING]: '等待中',
      [PatientState.DISCHARGED]: '已出院',
      [PatientState.DETERIORATED]: '病情恶化',
      [PatientState.DECEASED]: '死亡'
    };
    return names[this.state] || this.state;
  }

  getErrors() {
    return {
      triageErrors: [...this.triageErrors],
      actionErrors: [...this.actionErrors],
      hasDeteriorated: this.hasDeteriorated
    };
  }

  getScoreImpact() {
    let impact = 0;
    let details = [];

    if (this.triageErrors.length > 0) {
      impact -= 20;
      details.push({ type: 'triage_error', points: -20, message: '分诊级别错误' });
    }

    if (this.hasDeteriorated) {
      impact -= 30;
      details.push({ type: 'deterioration', points: -30, message: '患者病情恶化' });
    }

    if (this.isolationStatus && !this.isolationPerformed) {
      impact -= 15;
      details.push({ type: 'isolation_missed', points: -15, message: '隔离措施漏做' });
    }

    const requiredCompleted = this.requiredActions.filter(
      action => this.completedActions.some(c => c.actionId === action)
    );

    if (requiredCompleted.length === this.requiredActions.length) {
      if (this.triageErrors.length === 0 && !this.hasDeteriorated) {
        impact += 20;
        details.push({ type: 'correct_handling', points: 20, message: '高危患者正确处理' });
      }
    }

    return {
      total: impact,
      details: details
    };
  }

  toJSON() {
    return {
      id: this.id,
      arrivalTime: this.arrivalTime,
      chiefComplaint: this.chiefComplaint,
      vitalSigns: { ...this.vitalSigns },
      riskFactors: [...this.riskFactors],
      correctTriage: this.correctTriage,
      currentTriage: this.currentTriage,
      state: this.state,
      waitTime: this.waitTime,
      familyStress: this.familyStress,
      completedActions: [...this.completedActions],
      currentAction: this.currentAction,
      hasDeteriorated: this.hasDeteriorated,
      triageErrors: [...this.triageErrors],
      actionErrors: [...this.actionErrors],
      isolationStatus: this.isolationStatus,
      isolationPerformed: this.isolationPerformed,
      requiredActions: [...this.requiredActions]
    };
  }
}

export { Patient, PatientState, TriageLevel };
