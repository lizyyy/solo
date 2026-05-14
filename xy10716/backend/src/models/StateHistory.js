const mongoose = require('mongoose');

const stateHistorySchema = new mongoose.Schema({
  switchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeatureSwitch',
    required: true,
    index: true
  },
  switchName: {
    type: String,
    required: true
  },
  operationType: {
    type: String,
    enum: ['CREATE', 'UPDATE', 'ENABLE', 'DISABLE', 'ROLLBACK', 'CORRECT', 'TARGET_CHANGE'],
    required: true
  },
  previousState: {
    isActive: Boolean,
    targetUsers: [String],
    ruleExpression: String,
    version: Number
  },
  newState: {
    isActive: Boolean,
    targetUsers: [String],
    ruleExpression: String,
    version: Number
  },
  status: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILED', 'ROLLED_BACK', 'CORRECTED'],
    default: 'PENDING'
  },
  requestId: {
    type: String,
    required: true,
    index: true
  },
  idempotencyKey: {
    type: String,
    index: true
  },
  operator: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    default: ''
  },
  errorMessage: {
    type: String,
    default: ''
  },
  retryCount: {
    type: Number,
    default: 0
  },
  rollbackReason: {
    type: String,
    default: ''
  },
  correctionReason: {
    type: String,
    default: ''
  },
  correctedBy: {
    type: String
  },
  correctedAt: {
    type: Date
  },
  targetUsersAtTime: [{
    type: String
  }],
  affectedUsers: [{
    userId: String,
    action: String,
    timestamp: Date
  }],
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

stateHistorySchema.index({ switchId: 1, createdAt: -1 });
stateHistorySchema.index({ requestId: 1 }, { unique: true });

module.exports = mongoose.model('StateHistory', stateHistorySchema);
