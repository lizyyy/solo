const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const RISK_TYPES = {
  TEMPERATURE_VIOLATION: 'temperature_violation',
  DELAY: 'delay',
  SIGNATURE_MISSING: 'signature_missing',
  CHAIN_BREAK: 'chain_break',
  OTHER: 'other'
};

const SEVERITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

const STATUS = {
  OPEN: 'open',
  IN_REVIEW: 'in_review',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed'
};

class RiskEvent {
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.batchId = options.batchId || null;
    this.boxId = options.boxId || null;
    this.handoverFormId = options.handoverFormId || null;
    this.type = options.type || RISK_TYPES.OTHER;
    this.severity = options.severity || SEVERITY_LEVELS.MEDIUM;
    this.status = options.status || STATUS.OPEN;
    this.title = options.title || '';
    this.description = options.description || '';
    this.details = options.details || {};
    this.occurredAt = options.occurredAt || moment().toISOString();
    this.detectedAt = options.detectedAt || moment().toISOString();
    this.assignedTo = options.assignedTo || null;
    this.resolutionNotes = options.resolutionNotes || '';
    this.resolvedAt = options.resolvedAt || null;
    this.createdAt = options.createdAt || moment().toISOString();
    this.updatedAt = options.updatedAt || moment().toISOString();
  }

  updateStatus(newStatus, notes = '') {
    this.status = newStatus;
    if (newStatus === STATUS.RESOLVED) {
      this.resolvedAt = moment().toISOString();
    }
    if (notes) {
      this.resolutionNotes = notes;
    }
    this.updatedAt = moment().toISOString();
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      batchId: this.batchId,
      boxId: this.boxId,
      handoverFormId: this.handoverFormId,
      type: this.type,
      severity: this.severity,
      status: this.status,
      title: this.title,
      description: this.description,
      details: this.details,
      occurredAt: this.occurredAt,
      detectedAt: this.detectedAt,
      assignedTo: this.assignedTo,
      resolutionNotes: this.resolutionNotes,
      resolvedAt: this.resolvedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static fromJSON(json) {
    return new RiskEvent(json);
  }
}

module.exports = RiskEvent;
module.exports.RISK_TYPES = RISK_TYPES;
module.exports.SEVERITY_LEVELS = SEVERITY_LEVELS;
module.exports.STATUS = STATUS;
