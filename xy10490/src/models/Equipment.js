const mongoose = require('mongoose');

const equipmentSchema = new mongoose.Schema({
  equipmentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  productionLine: {
    type: String,
    required: true
  },
  location: {
    type: String
  },
  initialRunningHours: {
    type: Number,
    required: true,
    default: 0
  },
  currentRunningHours: {
    type: Number,
    required: true,
    default: 0
  },
  lastReportTime: {
    type: Date
  },
  maintenanceCycleType: {
    type: String,
    enum: ['hour', 'date'],
    required: true,
    default: 'hour'
  },
  maintenanceCycleValue: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

equipmentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Equipment', equipmentSchema);
