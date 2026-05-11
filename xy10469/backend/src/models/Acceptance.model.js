const mongoose = require('mongoose');

const acceptanceItemSchema = new mongoose.Schema({
  itemName: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['equipment', 'cleanliness', 'electricity', 'structure', 'other'],
    required: true
  },
  status: {
    type: String,
    enum: ['pass', 'fail', 'na'],
    default: 'pass'
  },
  notes: {
    type: String,
    trim: true
  },
  deductionAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  deductionReason: {
    type: String,
    trim: true
  }
});

const acceptanceSchema = new mongoose.Schema({
  acceptanceNo: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true
  },
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: true
  },
  boothId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booth',
    required: true
  },
  type: {
    type: String,
    enum: ['admission', 'withdrawal'],
    required: true
  },
  items: [acceptanceItemSchema],
  overallStatus: {
    type: String,
    enum: ['pending', 'in_progress', 'passed', 'failed'],
    default: 'pending'
  },
  totalDeduction: {
    type: Number,
    default: 0,
    min: 0
  },
  canRefundDeposit: {
    type: Boolean,
    default: false
  },
  inspector: {
    type: String,
    trim: true
  },
  inspectionDate: {
    type: Date,
    default: Date.now
  },
  conclusion: {
    type: String,
    trim: true
  },
  merchantSignature: {
    type: String,
    trim: true
  },
  signatureDate: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

acceptanceSchema.index({ acceptanceNo: 1 });
acceptanceSchema.index({ applicationId: 1 });
acceptanceSchema.index({ type: 1 });
acceptanceSchema.index({ overallStatus: 1 });

module.exports = mongoose.model('Acceptance', acceptanceSchema);