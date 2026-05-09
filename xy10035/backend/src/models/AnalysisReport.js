const mongoose = require('mongoose');

const analysisReportSchema = new mongoose.Schema({
  reportId: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  filters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  summary: {
    totalLogs: Number,
    errorCount: Number,
    warningCount: Number,
    anomalyCount: Number,
    topServices: [String],
    timeRange: {
      start: Date,
      end: Date
    }
  },
  statistics: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  anomalies: [{
    type: {
      type: String
    },
    count: Number,
    description: String,
    examples: [{
      traceId: String,
      message: String,
      timestamp: Date
    }]
  }],
  topTraces: [{
    traceId: String,
    status: String,
    duration: Number,
    anomalyCount: Number
  }]
}, {
  timestamps: true
});

analysisReportSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model('AnalysisReport', analysisReportSchema);
