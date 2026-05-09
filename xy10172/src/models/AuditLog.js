const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const AUDIT_ACTIONS = {
  CREATE_CONTRACT: 'create_contract',
  UPDATE_CONTRACT: 'update_contract',
  INITIATE_SIGNING: 'initiate_signing',
  SIGN: 'sign',
  REJECT: 'reject',
  WITHDRAW: 'withdraw',
  REINITIATE: 'reinitiate',
  SUPPLEMENT_SIGN: 'supplement_sign',
  COMPLETE: 'complete',
  FREEZE_VERSION: 'freeze_version',
  CALLBACK_SUCCESS: 'callback_success',
  CALLBACK_FAILED: 'callback_failed',
  CALLBACK_RETRY: 'callback_retry',
  METADATA_UPDATE: 'metadata_update',
  STATUS_CHANGE: 'status_change',
  COMPENSATION: 'compensation'
};

const auditLogSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => `AUD-${uuidv4().slice(0, 8).toUpperCase()}`
  },
  operationId: {
    type: String,
    required: true,
    index: true,
    unique: true
  },
  contractId: {
    type: String,
    index: true
  },
  contractNo: {
    type: String,
    index: true
  },
  version: {
    type: Number,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: Object.values(AUDIT_ACTIONS),
    index: true
  },
  description: {
    type: String,
    required: true
  },
  operator: {
    id: String,
    name: String,
    email: String,
    ip: String,
    userAgent: String
  },
  previousState: {
    status: String,
    version: Number,
    parties: mongoose.Schema.Types.Mixed,
    metadata: mongoose.Schema.Types.Mixed
  },
  currentState: {
    status: String,
    version: Number,
    parties: mongoose.Schema.Types.Mixed,
    metadata: mongoose.Schema.Types.Mixed
  },
  requestId: String,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  source: {
    type: String,
    enum: ['api', 'callback', 'system', 'manual', 'compensation'],
    default: 'api'
  },
  details: mongoose.Schema.Types.Mixed,
  success: {
    type: Boolean,
    default: true
  },
  errorMessage: String,
  compensationStatus: {
    type: String,
    enum: ['none', 'pending', 'in_progress', 'completed', 'failed'],
    default: 'none'
  },
  compensationOperationId: String
}, {
  timestamps: true,
  versionKey: 'docVersion'
});

auditLogSchema.index({ contractId: 1, timestamp: -1 });
auditLogSchema.index({ contractNo: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ 'operator.id': 1, timestamp: -1 });
auditLogSchema.index({ operationId: 1 });

auditLogSchema.statics.getActions = () => AUDIT_ACTIONS;

module.exports = mongoose.model('AuditLog', auditLogSchema);
