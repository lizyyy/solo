const mongoose = require('mongoose');

const traceSessionSchema = new mongoose.Schema({
  traceId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  userId: {
    type: String,
    index: true
  },
  services: {
    type: [String],
    default: []
  },
  status: {
    type: String,
    enum: ['RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL'],
    default: 'RUNNING'
  },
  totalSteps: {
    type: Number,
    default: 0
  },
  successSteps: {
    type: Number,
    default: 0
  },
  failedSteps: {
    type: Number,
    default: 0
  },
  anomalies: {
    type: [{
      type: {
        type: String,
        enum: ['DUPLICATE', 'CONCURRENCY', 'TIMING_ISSUE', 'CACHE_STALE', 'ROLLBACK_FAILED', 'ASYNC_OUT_OF_ORDER']
      },
      description: String,
      timestamp: Date,
      affectedSteps: [String]
    }],
    default: []
  },
  summary: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

traceSessionSchema.index({ userId: 1, startTime: -1 });

module.exports = mongoose.model('TraceSession', traceSessionSchema);
