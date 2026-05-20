const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  logId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  recordId: {
    type: String,
    ref: 'MaterialRecord',
    index: true
  },
  orderNumber: {
    type: String,
    ref: 'RepairOrder',
    index: true
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  previousStatus: {
    type: String
  },
  newStatus: {
    type: String
  },
  operator: {
    type: String,
    required: true
  },
  operateTime: {
    type: Date,
    default: Date.now
  },
  reason: {
    type: String
  },
  remarks: {
    type: String
  },
  changes: {
    type: mongoose.Schema.Types.Mixed
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

auditLogSchema.index({ recordId: 1, createdAt: -1 });
auditLogSchema.index({ orderNumber: 1, createdAt: -1 });
auditLogSchema.index({ operator: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
