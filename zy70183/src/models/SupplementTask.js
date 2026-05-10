const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const supplementTaskSchema = new mongoose.Schema({
  taskId: {
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
  taskType: {
    type: String,
    enum: ['MISSING', 'INVALID', 'MANUAL_REQUEST'],
    required: true
  },
  requiredAttachments: [{
    attachmentType: {
      type: String,
      required: true
    },
    attachmentName: {
      type: String,
      required: true
    },
    reason: String,
    originalAttachmentId: String
  }],
  deadline: Date,
  status: {
    type: String,
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'CANCELLED'],
    default: 'PENDING'
  },
  assignedTo: String,
  createdBy: String,
  completedAt: Date,
  completedBy: String,
  completionNote: String,
  reminderSent: {
    type: Number,
    default: 0
  },
  lastReminderAt: Date
}, {
  timestamps: true,
  versionKey: false
});

supplementTaskSchema.index({ enterpriseCode: 1, periodCode: 1 });
supplementTaskSchema.index({ status: 1 });
supplementTaskSchema.index({ deadline: 1 });

module.exports = mongoose.model('SupplementTask', supplementTaskSchema);
