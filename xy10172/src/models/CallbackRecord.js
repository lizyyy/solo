const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const CALLBACK_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
  RETRYING: 'retrying',
  EXHAUSTED: 'exhausted',
  DUPLICATE: 'duplicate',
  COMPENSATED: 'compensated'
};

const CALLBACK_EVENTS = {
  CONTRACT_CREATED: 'contract_created',
  SIGNING_INITIATED: 'signing_initiated',
  PARTY_SIGNED: 'party_signed',
  PARTY_REJECTED: 'party_rejected',
  CONTRACT_WITHDRAWN: 'contract_withdrawn',
  CONTRACT_REJECTED: 'contract_rejected',
  CONTRACT_COMPLETED: 'contract_completed',
  CONTRACT_REINITIATED: 'contract_reinitiated',
  VERSION_FROZEN: 'version_frozen'
};

const callbackRecordSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => `CBK-${uuidv4().slice(0, 8).toUpperCase()}`
  },
  callbackId: {
    type: String,
    required: true,
    index: true,
    unique: true
  },
  eventId: {
    type: String,
    required: true,
    index: true
  },
  contractId: {
    type: String,
    required: true,
    index: true
  },
  contractNo: {
    type: String,
    index: true
  },
  version: {
    type: Number
  },
  event: {
    type: String,
    required: true,
    enum: Object.values(CALLBACK_EVENTS),
    index: true
  },
  callbackUrl: {
    type: String,
    required: true
  },
  payload: mongoose.Schema.Types.Mixed,
  status: {
    type: String,
    required: true,
    enum: Object.values(CALLBACK_STATUS),
    default: CALLBACK_STATUS.PENDING,
    index: true
  },
  attemptCount: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 5
  },
  nextRetryAt: Date,
  lastAttemptAt: Date,
  lastResponse: {
    statusCode: Number,
    data: mongoose.Schema.Types.Mixed,
    error: String
  },
  retryStrategy: {
    type: String,
    enum: ['exponential', 'linear', 'fixed'],
    default: 'exponential'
  },
  retryInterval: {
    type: Number,
    default: 60000
  },
  deduplicationKey: {
    type: String,
    index: true
  },
  isDuplicate: {
    type: Boolean,
    default: false
  },
  originalCallbackId: String,
  operationId: {
    type: String,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  processedAt: Date,
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

callbackRecordSchema.index({ contractId: 1, event: 1, createdAt: -1 });
callbackRecordSchema.index({ status: 1, nextRetryAt: 1 });
callbackRecordSchema.index({ deduplicationKey: 1 });

callbackRecordSchema.statics.getStatuses = () => CALLBACK_STATUS;
callbackRecordSchema.statics.getEvents = () => CALLBACK_EVENTS;

callbackRecordSchema.methods.canRetry = function() {
  return this.attemptCount < this.maxAttempts;
};

callbackRecordSchema.methods.markProcessing = function() {
  this.status = CALLBACK_STATUS.PROCESSING;
  return this.save();
};

callbackRecordSchema.methods.markSuccess = function(response) {
  this.status = CALLBACK_STATUS.SUCCESS;
  this.processedAt = new Date();
  this.attemptCount += 1;
  this.lastAttemptAt = new Date();
  if (response) {
    this.lastResponse = {
      statusCode: response.status,
      data: response.data
    };
  }
  return this.save();
};

callbackRecordSchema.methods.markFailed = function(error, shouldRetry = true) {
  this.attemptCount += 1;
  this.lastAttemptAt = new Date();
  this.lastResponse = {
    error: error.message || error
  };

  if (shouldRetry && this.canRetry()) {
    this.status = CALLBACK_STATUS.RETRYING;
    this.nextRetryAt = this.calculateNextRetry();
  } else if (this.attemptCount >= this.maxAttempts) {
    this.status = CALLBACK_STATUS.EXHAUSTED;
  } else {
    this.status = CALLBACK_STATUS.FAILED;
  }
  return this.save();
};

callbackRecordSchema.methods.calculateNextRetry = function() {
  const now = new Date();
  let delay;

  switch (this.retryStrategy) {
    case 'exponential':
      delay = Math.min(this.retryInterval * Math.pow(2, this.attemptCount), 3600000);
      break;
    case 'linear':
      delay = this.retryInterval * (this.attemptCount + 1);
      break;
    case 'fixed':
    default:
      delay = this.retryInterval;
  }

  return new Date(now.getTime() + delay);
};

module.exports = mongoose.model('CallbackRecord', callbackRecordSchema);
