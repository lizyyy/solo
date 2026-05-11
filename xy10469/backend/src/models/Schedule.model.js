const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['planning', 'active', 'completed', 'cancelled'],
    default: 'planning'
  },
  boothTypes: [{
    type: String,
    enum: ['food', 'cultural', 'promotion']
  }],
  targetMerchants: {
    type: String,
    trim: true
  },
  totalSlots: {
    type: Number,
    required: true,
    min: 1
  },
  notes: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

scheduleSchema.index({ status: 1 });
scheduleSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('Schedule', scheduleSchema);