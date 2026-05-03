const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { STATES, TRANSITIONS, StateMachine } = require('./stateMachine');

class HandoverForm {
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.formNumber = options.formNumber || `HO-${moment().format('YYYYMMDD')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    this.batchId = options.batchId || null;
    this.boxId = options.boxId || null;
    this.fromStationId = options.fromStationId || null;
    this.toStationId = options.toStationId || null;
    this.senderPersonId = options.senderPersonId || null;
    this.receiverPersonId = options.receiverPersonId || null;
    this.senderSignature = options.senderSignature || null;
    this.receiverSignature = options.receiverSignature || null;
    this.senderSignatureTime = options.senderSignatureTime || null;
    this.receiverSignatureTime = options.receiverSignatureTime || null;
    this.handoffTime = options.handoffTime || null;
    this.actualReceiveTime = options.actualReceiveTime || null;
    this.temperatureAtHandover = options.temperatureAtHandover || null;
    this.vehiclePlate = options.vehiclePlate || '';
    this.notes = options.notes || '';
    this.stateMachine = options.stateMachine 
      ? StateMachine.fromJSON(options.stateMachine)
      : new StateMachine(STATES.HANDOVER.PENDING, TRANSITIONS.HANDOVER);
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

  hasCompleteSignatures() {
    return this.senderSignature !== null && this.receiverSignature !== null;
  }

  isSenderSigned() {
    return this.senderSignature !== null;
  }

  isReceiverSigned() {
    return this.receiverSignature !== null;
  }

  getMissingSignatures() {
    const missing = [];
    if (!this.senderSignature) missing.push('sender');
    if (!this.receiverSignature) missing.push('receiver');
    return missing;
  }

  signSender(signatureId, personId = null) {
    this.senderSignature = signatureId;
    this.senderSignatureTime = moment().toISOString();
    if (personId) {
      this.senderPersonId = personId;
    }
    this.updatedAt = moment().toISOString();
    return this;
  }

  signReceiver(signatureId, personId = null) {
    this.receiverSignature = signatureId;
    this.receiverSignatureTime = moment().toISOString();
    if (personId) {
      this.receiverPersonId = personId;
    }
    this.actualReceiveTime = moment().toISOString();
    this.updatedAt = moment().toISOString();
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      formNumber: this.formNumber,
      batchId: this.batchId,
      boxId: this.boxId,
      fromStationId: this.fromStationId,
      toStationId: this.toStationId,
      senderPersonId: this.senderPersonId,
      receiverPersonId: this.receiverPersonId,
      senderSignature: this.senderSignature,
      receiverSignature: this.receiverSignature,
      senderSignatureTime: this.senderSignatureTime,
      receiverSignatureTime: this.receiverSignatureTime,
      handoffTime: this.handoffTime,
      actualReceiveTime: this.actualReceiveTime,
      temperatureAtHandover: this.temperatureAtHandover,
      vehiclePlate: this.vehiclePlate,
      notes: this.notes,
      currentState: this.currentState,
      stateMachine: this.stateMachine.toJSON(),
      hasCompleteSignatures: this.hasCompleteSignatures(),
      missingSignatures: this.getMissingSignatures(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static fromJSON(json) {
    return new HandoverForm(json);
  }
}

module.exports = HandoverForm;
