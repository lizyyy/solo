const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const AUDIT_ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  IMPORT: 'import',
  EXPORT: 'export',
  REVIEW: 'review',
  RESOLVE_RISK: 'resolve_risk',
  SIGN_HANDOVER: 'sign_handover',
  STATE_TRANSITION: 'state_transition',
  OTHER: 'other'
};

const ENTITY_TYPES = {
  BATCH: 'batch',
  BOX: 'box',
  STATION: 'station',
  RESPONSIBLE_PERSON: 'responsible_person',
  TEMPERATURE_LOG: 'temperature_log',
  VEHICLE_TRAJECTORY: 'vehicle_trajectory',
  HANDOVER_FORM: 'handover_form',
  RISK_EVENT: 'risk_event',
  REVIEW: 'review',
  REPORT: 'report'
};

class AuditEvent {
  constructor(options = {}) {
    this.id = options.id || uuidv4();
    this.action = options.action || AUDIT_ACTIONS.OTHER;
    this.entityType = options.entityType || null;
    this.entityId = options.entityId || null;
    this.userId = options.userId || null;
    this.userName = options.userName || '';
    this.timestamp = options.timestamp || moment().toISOString();
    this.details = options.details || {};
    this.oldValue = options.oldValue || null;
    this.newValue = options.newValue || null;
    this.ipAddress = options.ipAddress || '';
    this.userAgent = options.userAgent || '';
    this.createdAt = options.createdAt || moment().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      action: this.action,
      entityType: this.entityType,
      entityId: this.entityId,
      userId: this.userId,
      userName: this.userName,
      timestamp: this.timestamp,
      details: this.details,
      oldValue: this.oldValue,
      newValue: this.newValue,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      createdAt: this.createdAt
    };
  }

  static fromJSON(json) {
    return new AuditEvent(json);
  }
}

module.exports = AuditEvent;
module.exports.AUDIT_ACTIONS = AUDIT_ACTIONS;
module.exports.ENTITY_TYPES = ENTITY_TYPES;
