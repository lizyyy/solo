const mongoose = require('mongoose');

const declarationRecordSchema = new mongoose.Schema({
  enterpriseCode: {
    type: String,
    required: true,
    index: true
  },
  periodCode: {
    type: String,
    required: true,
    index: true
  },
  overallStatus: {
    type: String,
    enum: ['DRAFT', 'PENDING_VALIDATION', 'VALID', 'MISSING_ATTACHMENTS', 'INVALID', 'READY_TO_DECLARE', 'DECLARED', 'MANUAL_CORRECTED'],
    default: 'DRAFT'
  },
  validationResult: {
    isComplete: {
      type: Boolean,
      default: false
    },
    missingAttachments: {
      type: [{
        attachmentType: String,
        attachmentName: String,
        isRequired: Boolean
      }],
      default: []
    },
    invalidAttachments: {
      type: [{
        attachmentId: String,
        attachmentType: String,
        attachmentName: String,
        reasons: [String]
      }],
      default: []
    },
    validatedAttachments: {
      type: [{
        attachmentId: String,
        attachmentType: String,
        attachmentName: String
      }],
      default: []
    },
    validationTime: Date,
    validator: String
  },
  attachmentSummary: {
    totalRequired: {
      type: Number,
      default: 0
    },
    totalOptional: {
      type: Number,
      default: 0
    },
    uploadedRequired: {
      type: Number,
      default: 0
    },
    uploadedOptional: {
      type: Number,
      default: 0
    },
    validRequired: {
      type: Number,
      default: 0
    },
    validOptional: {
      type: Number,
      default: 0
    }
  },
  declarationTime: Date,
  declaredBy: String,
  lastCorrectionTime: Date,
  lastCorrectedBy: String,
  correctionReasons: [{
    time: Date,
    operator: String,
    reason: String,
    oldStatus: String,
    newStatus: String
  }],
  remark: String,
  createdBy: String,
  updatedBy: String
}, {
  timestamps: true,
  versionKey: false
});

declarationRecordSchema.index({ enterpriseCode: 1, periodCode: 1 }, { unique: true });
declarationRecordSchema.index({ overallStatus: 1 });
declarationRecordSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('DeclarationRecord', declarationRecordSchema);
