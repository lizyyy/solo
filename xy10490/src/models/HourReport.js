const mongoose = require('mongoose');

const hourReportSchema = new mongoose.Schema({
  reportId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  equipmentId: {
    type: String,
    required: true,
    index: true
  },
  runningHours: {
    type: Number,
    required: true
  },
  reportTime: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  reportedBy: {
    type: String
  },
  previousHours: {
    type: Number
  },
  deltaHours: {
    type: Number
  },
  isDuplicate: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

hourReportSchema.index({ equipmentId: 1, runningHours: 1 }, { unique: true });

module.exports = mongoose.model('HourReport', hourReportSchema);
