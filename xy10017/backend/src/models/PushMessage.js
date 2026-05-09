const mongoose = require('mongoose');

const pushMessageSchema = new mongoose.Schema({
  idempotencyKey: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  content: {
    type: String,
    required: true,
  },
  pushType: {
    type: String,
    enum: ['broadcast', 'targeted', 'system'],
    default: 'broadcast',
  },
  targetUsers: {
    type: [String],
    default: [],
  },
  priority: {
    type: Number,
    default: 0,
    index: true,
  },
  scheduledAt: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ['pending', 'queued', 'processing', 'sent', 'failed', 'partially_failed', 'cancelled'],
    default: 'pending',
    index: true,
  },
  retryCount: {
    type: Number,
    default: 0,
  },
  maxRetries: {
    type: Number,
    default: 3,
  },
  streamMessageId: {
    type: String,
    index: true,
  },
  sentAt: {
    type: Date,
  },
  failedAt: {
    type: Date,
  },
  errorMessage: {
    type: String,
  },
  totalRecipients: {
    type: Number,
    default: 0,
  },
  deliveredCount: {
    type: Number,
    default: 0,
  },
  failedCount: {
    type: Number,
    default: 0,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  version: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

pushMessageSchema.index({ status: 1, createdAt: 1 });
pushMessageSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model('PushMessage', pushMessageSchema);
