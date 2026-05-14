const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  switchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeatureSwitch',
    index: true
  },
  switchName: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true
  },
  actor: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  requestId: {
    type: String,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

auditLogSchema.index({ switchId: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
