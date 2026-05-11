const mongoose = require('mongoose');

const skipRequestSchema = new mongoose.Schema({
  requestId: {
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
  reason: {
    type: String,
    required: true
  },
  requestedBy: {
    type: String,
    required: true
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  approvedBy: {
    type: String
  },
  approvedAt: {
    type: Date
  },
  approvalNotes: {
    type: String
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

skipRequestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('SkipRequest', skipRequestSchema);
