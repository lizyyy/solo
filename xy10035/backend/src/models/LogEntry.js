const mongoose = require('mongoose');

const logEntrySchema = new mongoose.Schema({
  traceId: {
    type: String,
    required: true,
    index: true
  },
  spanId: {
    type: String,
    required: true,
    unique: true
  },
  parentSpanId: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  level: {
    type: String,
    enum: ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'],
    required: true,
    index: true
  },
  source: {
    type: String,
    required: true,
    index: true
  },
  service: {
    type: String,
    required: true,
    index: true
  },
  operation: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    index: true
  },
  requestId: {
    type: String,
    index: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['START', 'PROCESSING', 'SUCCESS', 'FAILED', 'ROLLBACK', 'TIMEOUT'],
    default: 'PROCESSING'
  },
  duration: {
    type: Number,
    default: 0
  },
  tags: {
    type: [String],
    default: [],
    index: true
  },
  anomalies: {
    type: [{
      type: String,
      enum: ['DUPLICATE', 'CONCURRENCY', 'TIMING_ISSUE', 'CACHE_STALE', 'ROLLBACK_FAILED', 'ASYNC_OUT_OF_ORDER']
    }],
    default: []
  }
}, {
  timestamps: true
});

logEntrySchema.index({ traceId: 1, timestamp: 1 });
logEntrySchema.index({ level: 1, timestamp: -1 });

module.exports = mongoose.model('LogEntry', logEntrySchema);
