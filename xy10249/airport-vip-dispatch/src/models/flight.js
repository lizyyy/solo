const { FLIGHT_STATUS, AIRPORT_GATES } = require('../config');

class Flight {
  constructor(data) {
    this.id = data.id;
    this.flightNumber = data.flightNumber;
    this.scheduledDeparture = new Date(data.scheduledDeparture);
    this.actualDeparture = data.actualDeparture ? new Date(data.actualDeparture) : null;
    this.status = data.status || FLIGHT_STATUS.SCHEDULED;
    this.gate = data.gate;
    this.destination = data.destination;
    this.airline = data.airline;
    this.passengerName = data.passengerName;
    this.passengerLevel = data.passengerLevel || 'gold';
    this.vehiclePreference = data.vehiclePreference || null;
    this.delayMinutes = data.delayMinutes || 0;
    this.gateChangeHistory = data.gateChangeHistory || [];
    this.vipRequests = data.vipRequests || [];
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
  }

  updateDelay(newDelayMinutes, reason) {
    const oldDelay = this.delayMinutes;
    this.delayMinutes = newDelayMinutes;
    this.status = newDelayMinutes > 0 ? FLIGHT_STATUS.DELAYED : FLIGHT_STATUS.SCHEDULED;

    if (this.scheduledDeparture) {
      this.actualDeparture = new Date(
        this.scheduledDeparture.getTime() + newDelayMinutes * 60 * 1000
      );
    }

    this.updatedAt = new Date();

    return {
      flightId: this.id,
      flightNumber: this.flightNumber,
      oldDelayMinutes: oldDelay,
      newDelayMinutes: newDelayMinutes,
      delayChange: newDelayMinutes - oldDelay,
      reason,
      updatedAt: this.updatedAt
    };
  }

  changeGate(newGate, reason) {
    if (!AIRPORT_GATES[newGate]) {
      throw new Error(`无效的登机口: ${newGate}`);
    }

    const oldGate = this.gate;
    this.gateChangeHistory.push({
      oldGate,
      newGate,
      reason,
      changedAt: new Date()
    });
    this.gate = newGate;
    this.updatedAt = new Date();

    return {
      flightId: this.id,
      flightNumber: this.flightNumber,
      oldGate,
      newGate,
      reason,
      distanceToGate: AIRPORT_GATES[newGate].distance,
      updatedAt: this.updatedAt
    };
  }

  getEffectiveDepartureTime() {
    return this.actualDeparture || this.scheduledDeparture;
  }

  getGateInfo() {
    return AIRPORT_GATES[this.gate] || null;
  }

  toJSON() {
    return {
      id: this.id,
      flightNumber: this.flightNumber,
      scheduledDeparture: this.scheduledDeparture.toISOString(),
      actualDeparture: this.actualDeparture ? this.actualDeparture.toISOString() : null,
      status: this.status,
      gate: this.gate,
      destination: this.destination,
      airline: this.airline,
      passengerName: this.passengerName,
      passengerLevel: this.passengerLevel,
      vehiclePreference: this.vehiclePreference,
      delayMinutes: this.delayMinutes,
      gateChangeHistory: this.gateChangeHistory,
      vipRequests: this.vipRequests,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }

  static fromJSON(json) {
    return new Flight(json);
  }

  validate() {
    const errors = [];

    if (!this.id) errors.push('航班ID不能为空');
    if (!this.flightNumber) errors.push('航班号不能为空');
    if (!this.scheduledDeparture) errors.push('计划起飞时间不能为空');
    if (!this.gate) errors.push('登机口不能为空');

    if (this.gate && !AIRPORT_GATES[this.gate]) {
      errors.push(`无效的登机口: ${this.gate}`);
    }

    if (this.passengerLevel && !['platinum', 'gold', 'silver'].includes(this.passengerLevel)) {
      errors.push(`无效的贵宾等级: ${this.passengerLevel}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = Flight;
