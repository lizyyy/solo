const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { STATES, TRANSITIONS, StateMachine } = require('./stateMachine');

class Box {
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.name = options.name || '';
    this.serialNumber = options.serialNumber || '';
    this.capacity = options.capacity || 0;
    this.currentBatchId = options.currentBatchId || null;
    this.stateMachine = options.stateMachine 
      ? StateMachine.fromJSON(options.stateMachine)
      : new StateMachine(STATES.BOX.IDLE, TRANSITIONS.BOX);
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

  assignBatch(batchId) {
    if (this.currentBatchId) {
      throw new Error(`Box ${this.id} already has a batch assigned`);
    }
    this.currentBatchId = batchId;
    this.updatedAt = moment().toISOString();
    return this;
  }

  releaseBatch() {
    this.currentBatchId = null;
    this.updatedAt = moment().toISOString();
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      serialNumber: this.serialNumber,
      capacity: this.capacity,
      currentBatchId: this.currentBatchId,
      currentState: this.currentState,
      stateMachine: this.stateMachine.toJSON(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static fromJSON(json) {
    return new Box(json);
  }
}

module.exports = Box;
