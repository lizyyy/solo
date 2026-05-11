const mongoose = require('mongoose');

const downtimeImpactSchema = new mongoose.Schema({
  impactId: {
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
    ref: 'MaintenancePlan'
  },
  maintenanceType: {
    type: String,
    enum: ['overdue', 'preventive', 'corrective']
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  durationMinutes: {
    type: Number
  },
  affectedProductionLine: {
    type: String,
    required: true
  },
  impactDescription: {
    type: String
  },
  estimatedLoss: {
    type: Number
  },
  reportedBy: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('DowntimeImpact', downtimeImpactSchema);
