const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const attachmentSchema = new mongoose.Schema({
  attachmentId: {
    type: String,
    default: uuidv4,
    unique: true,
    index: true
  },
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
  sourceSystem: {
    type: String,
    required: true
  },
  attachmentType: {
    type: String,
    required: true,
    index: true
  },
  attachmentName: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  storagePath: {
    type: String,
    required: true
  },
  uploadTime: {
    type: Date,
    default: Date.now
  },
  uploadUser: String,
  validationStatus: {
    type: String,
    enum: ['PENDING', 'VALID', 'INVALID', 'MANUAL_CORRECTED'],
    default: 'PENDING'
  },
  validationMessages: {
    type: [String],
    default: []
  },
  validatedAt: Date,
  isValidated: {
    type: Boolean,
    default: false
  },
  version: {
    type: Number,
    default: 1
  },
  isLatest: {
    type: Boolean,
    default: true
  },
  replacedByAttachmentId: String,
  replacesAttachmentId: String,
  remark: String,
  createdBy: String,
  updatedBy: String
}, {
  timestamps: true,
  versionKey: false
});

attachmentSchema.index({ enterpriseCode: 1, periodCode: 1, attachmentType: 1, isLatest: 1 });
attachmentSchema.index({ validationStatus: 1 });

module.exports = mongoose.model('Attachment', attachmentSchema);
