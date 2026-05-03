const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { STATES, TRANSITIONS, StateMachine } = require('./stateMachine');

class Batch {
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.batchNumber = options.batchNumber || '';
    this.vaccineName = options.vaccineName || '';
    this.quantity = options.quantity || 0;
    this.manufacturer = options.manufacturer || '';
    this.expiryDate = options.expiryDate || null;
    this.boxId = options.boxId || null;
    this.originStationId = options.originStationId || null;
    this.destinationStationId = options.destinationStationId || null;
    this.scheduledDepartureTime = options.scheduledDepartureTime || null;
    this.scheduledArrivalTime = options.scheduledArrivalTime || null;
    this.actualDepartureTime = options.actualDepartureTime || null;
    this.actualArrivalTime = options.actualArrivalTime || null;
    this.stateMachine = options.stateMachine 
      ? StateMachine.fromJSON(options.stateMachine)
      : new StateMachine(STATES.BATCH.PENDING, TRANSITIONS.BATCH);
    this.riskFlags = options.riskFlags || {
      temperatureViolation: false,
      delay: false,
      signatureMissing: false,
      chainBreak: false
    };
    this.createdAt = options.createdAt || moment().toISOString();
    this.updatedAt = options.updatedAt || moment().toISOString();
  }

  get currentState() {
    return this.stateMachine.getCurrentState();
  }

  canTransitionTo(newState) {
    return this.stateMachine.canTransitionTo(newState);
  }

  transitionTo(newState, reason = '') {
    const result = this.stateMachine.transitionTo(newState, reason);
    this.updatedAt = moment().toISOString();
    return result;
  }

  getStateHistory() {
    return this.stateMachine.getHistory();
  }

  getDelayMinutes() {
    if (!this.actualArrivalTime || !this.scheduledArrivalTime) {
      return 0;
    }
    return moment(this.actualArrivalTime).diff(moment(this.scheduledArrivalTime), 'minutes');
  }

  isDelayed(maxDelayMinutes) {
    const delay = this.getDelayMinutes();
    return delay > maxDelayMinutes;
  }

  setRiskFlag(flag, value) {
    if (this.riskFlags.hasOwnProperty(flag)) {
      this.riskFlags[flag] = value;
      this.updatedAt = moment().toISOString();
    }
  }

  hasAnyRisk() {
    return Object.values(this.riskFlags).some(flag => flag);
  }

  toJSON() {
    return {
      id: this.id,
      batchNumber: this.batchNumber,
      vaccineName: this.vaccineName,
      quantity: this.quantity,
      manufacturer: this.manufacturer,
      expiryDate: this.expiryDate,
      boxId: this.boxId,
      originStationId: this.originStationId,
      destinationStationId: this.destinationStationId,
      scheduledDepartureTime: this.scheduledDepartureTime,
      scheduledArrivalTime: this.scheduledArrivalTime,
      actualDepartureTime: this.actualDepartureTime,
      actualArrivalTime: this.actualArrivalTime,
      currentState: this.currentState,
      stateMachine: this.stateMachine.toJSON(),
      riskFlags: this.riskFlags,
      delayMinutes: this.getDelayMinutes(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static fromJSON(json) {
    return new Batch(json);
  }
}

module.exports = Batch;
