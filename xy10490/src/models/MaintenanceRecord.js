const mongoose = require('mongoose');

const maintenanceRecordSchema = new mongoose.Schema({
  recordId: {
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
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MaintenancePlan',
    required: true
  },
  maintenanceType: {
    type: String,
    enum: ['regular', 'catchup'],
    default: 'regular'
  },
  runningHours: {
    type: Number
  },
  completedBy: {
    type: String
  },
  completedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['completed', 'skipped']
  },
  notes: {
    type: String
  },
  beforeStatus: {
    type: String
  },
  nextPlanTargetHours: {
    type: Number
  },
  nextPlanTargetDate: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('MaintenanceRecord', maintenanceRecordSchema);
