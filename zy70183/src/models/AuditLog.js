const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const auditLogSchema = new mongoose.Schema({
  logId: {
    type: String,
    default: uuidv4,
    unique: true,
    index: true
  },
  logType: {
    type: String,
    enum: ['ATTACHMENT_UPLOAD', 'ATTACHMENT_VALIDATE', 'STATUS_CHANGE', 'MANUAL_CORRECTION', 'SUPPLEMENT_TASK', 'DECLARATION', 'RULE_CHANGE', 'SYSTEM'],
    required: true,
    index: true
  },
  enterpriseCode: {
    type: String,
    index: true
  },
  periodCode: {
    type: String,
    index: true
  },
  attachmentId: String,
  taskId: String,
  recordId: String,
  operator: {
    type: String,
    required: true
  },
  operatorRole: String,
  action: {
    type: String,
    required: true
  },
  oldValue: mongoose.Schema.Types.Mixed,
  newValue: mongoose.Schema.Types.Mixed,
  reason: String,
  sourceSystem: String,
  ipAddress: String,
  userAgent: String,
  details: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true,
  versionKey: false
});

auditLogSchema.index({ enterpriseCode: 1, periodCode: 1, createdAt: -1 });
auditLogSchema.index({ logType: 1, createdAt: -1 });
auditLogSchema.index({ attachmentId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
