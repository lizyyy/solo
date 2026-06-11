const { v4: uuidv4 } = require('uuid');

class Sensor {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.physicalId = data.physicalId;
    this.currentNumber = data.currentNumber;
    this.previousNumbers = data.previousNumbers || [];
    this.rollbackHistory = data.rollbackHistory || [];
    this.location = data.location;
    this.type = data.type;
    this.status = data.status || 'active';
    this.lastRestartTime = data.lastRestartTime || null;
    this.restartCount = data.restartCount || 0;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  static fromJSON(json) {
    return new Sensor(JSON.parse(json));
  }

  toJSON() {
    return {
      id: this.id,
      physicalId: this.physicalId,
      currentNumber: this.currentNumber,
      previousNumbers: this.previousNumbers,
      rollbackHistory: this.rollbackHistory,
      location: this.location,
      type: this.type,
      status: this.status,
      lastRestartTime: this.lastRestartTime,
      restartCount: this.restartCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  handleRestart(newNumber) {
    if (this.currentNumber !== newNumber) {
      this.previousNumbers.push({
        number: this.currentNumber,
        startTime: this.lastRestartTime || this.createdAt,
        endTime: new Date().toISOString()
      });
      this.currentNumber = newNumber;
      this.lastRestartTime = new Date().toISOString();
      this.restartCount += 1;
      this.updatedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  getNumberAtTime(timestamp) {
    for (let i = this.previousNumbers.length - 1; i >= 0; i--) {
      const history = this.previousNumbers[i];
      if (timestamp >= history.startTime && timestamp <= history.endTime) {
        return history.number;
      }
    }
    return this.currentNumber;
  }

  rollbackNumber(targetNumber, reason, operator) {
    if (this.currentNumber === targetNumber) {
      throw new Error('当前编号与目标编号相同，无需回滚');
    }

    const targetHistory = this.previousNumbers.find(h => h.number === targetNumber);
    if (!targetHistory) {
      throw new Error(`历史编号 ${targetNumber} 不存在`);
    }

    const oldNumber = this.currentNumber;
    const oldStartTime = this.lastRestartTime || this.createdAt;

    this.rollbackHistory.push({
      oldNumber,
      newNumber: targetNumber,
      reason,
      operator,
      timestamp: new Date().toISOString()
    });

    this.previousNumbers.push({
      number: this.currentNumber,
      startTime: oldStartTime,
      endTime: new Date().toISOString()
    });

    this.currentNumber = targetNumber;
    this.lastRestartTime = new Date().toISOString();
    this.updatedAt = new Date().toISOString();

    return {
      oldNumber,
      newNumber: targetNumber,
      reason,
      operator,
      timestamp: this.updatedAt
    };
  }

  getRollbackHistory() {
    return this.rollbackHistory;
  }
}

module.exports = Sensor;
